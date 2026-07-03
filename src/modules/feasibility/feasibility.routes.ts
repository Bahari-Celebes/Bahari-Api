import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole, assertCooperativeScope } from "../../middleware/rbac";
import { db } from "../../db";
import { feasibilityScenarios } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { calculateFeasibility, SCENARIO_PRESETS, type FeasibilityInput } from "../../engine";
import { z } from "zod";

export const feasibilityRoutes = new Hono<AppEnv>();

const calculateSchema = z.object({
  cooperativeId: z.string().uuid().optional(),
  capex: z.number().min(0),
  monthlyOpex: z.number().min(0),
  monthlyRevenue: z.number().min(0),
  margin: z.number().min(0).max(1).default(0.3),
  discountRate: z.number().min(0).max(1).default(0.12),
  projectionMonths: z.number().int().min(1).max(120).default(24),
  growthRate: z.number().min(0).max(1).default(0.02),
  logisticsCost: z.number().min(0).default(0),
  spoilageAssumption: z.number().min(0).max(1).default(0.05),
});

const saveSchema = calculateSchema.extend({
  cooperativeId: z.string().uuid(),
  scenarioName: z.string().min(1),
  priceAdjustment: z.number().default(0),
  costAdjustment: z.number().default(0),
  volumeAdjustment: z.number().default(0),
  spoilageAdjustment: z.number().default(0),
  paymentDelayDays: z.number().int().min(0).default(0),
});

// --- POST /feasibility/calculate ---
feasibilityRoutes.post("/calculate", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const data = calculateSchema.parse(body);
  const input: FeasibilityInput = {
    capex: data.capex,
    monthlyOpex: data.monthlyOpex,
    monthlyRevenue: data.monthlyRevenue,
    margin: data.margin,
    discountRate: data.discountRate,
    projectionMonths: data.projectionMonths,
    growthRate: data.growthRate,
    logisticsCost: data.logisticsCost,
    spoilageAssumption: data.spoilageAssumption,
  };
  const result = calculateFeasibility(input);
  return c.json(success(result));
});

// --- GET /feasibility/scenarios ---
feasibilityRoutes.get("/scenarios", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const cooperativeId = c.req.query("cooperativeId");

  const conditions = cooperativeId ? [eq(feasibilityScenarios.cooperativeId, cooperativeId)] : [];
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(feasibilityScenarios).where(where).limit(limit).offset(getOffset({ page, limit })),
    db.select({ count: sql<number>`count(*)` }).from(feasibilityScenarios).where(where),
  ]);
  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /feasibility/scenarios ---
feasibilityRoutes.post("/scenarios", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();
  const data = saveSchema.parse(body);
  assertCooperativeScope(user, data.cooperativeId);

  // Pre-compute results using the engine
  const input: FeasibilityInput = {
    capex: data.capex,
    monthlyOpex: data.monthlyOpex,
    monthlyRevenue: data.monthlyRevenue,
    margin: data.margin,
    discountRate: data.discountRate,
    projectionMonths: data.projectionMonths,
    growthRate: data.growthRate,
    logisticsCost: data.logisticsCost,
    spoilageAssumption: data.spoilageAssumption,
  };
  const result = calculateFeasibility(input, {
    priceAdjustment: data.priceAdjustment,
    costAdjustment: data.costAdjustment,
    volumeAdjustment: data.volumeAdjustment,
    spoilageAdjustment: data.spoilageAdjustment,
    paymentDelayDays: data.paymentDelayDays,
  });

  const [saved] = await db
    .insert(feasibilityScenarios)
    .values({
      ...data,
      resultNpv: String(Math.round(result.npv)),
      resultIrr: result.irr !== null ? String(result.irr) : null,
      resultPaybackPeriod: result.paybackPeriod !== null ? String(result.paybackPeriod) : null,
      resultBcr: String(result.bcr),
      resultStatus: result.status,
    })
    .returning();
  return c.json(success({ scenario: saved, result }), 201);
});

// --- GET /feasibility/scenarios/:id ---
feasibilityRoutes.get("/scenarios/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const [scenario] = await db.select().from(feasibilityScenarios).where(eq(feasibilityScenarios.id, id)).limit(1);
  if (!scenario) throw new NotFoundError("FeasibilityScenario", id);
  return c.json(success(scenario));
});

// --- DELETE /feasibility/scenarios/:id ---
feasibilityRoutes.delete("/scenarios/:id", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  const id = c.req.param("id");
  await db.delete(feasibilityScenarios).where(eq(feasibilityScenarios.id, id));
  return c.json(success({ deleted: true }));
});
