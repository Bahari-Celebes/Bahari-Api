import { Hono } from "hono";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware, getCurrentUser } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { success } from "../../lib/response.js";
import {
  calculateFeasibility,
  calculateSwitchingValue,
  calculateAllSwitchingValues,
  SCENARIO_PRESETS,
  type FeasibilityInput,
  type ScenarioAdjustments,
} from "../../engine/index.js";
import { z } from "zod";

export const scenarioRoutes = new Hono<AppEnv>();

const simulateSchema = z.object({
  capex: z.number().min(0),
  monthlyOpex: z.number().min(0),
  monthlyRevenue: z.number().min(0),
  margin: z.number().min(0).max(1).default(0.3),
  discountRate: z.number().min(0).max(1).default(0.12),
  projectionMonths: z.number().int().min(1).max(120).default(24),
  growthRate: z.number().min(0).max(1).default(0.02),
  logisticsCost: z.number().min(0).default(0),
  spoilageAssumption: z.number().min(0).max(1).default(0.05),
  adjustments: z
    .object({
      priceAdjustment: z.number().default(0),
      costAdjustment: z.number().default(0),
      volumeAdjustment: z.number().default(0),
      spoilageAdjustment: z.number().default(0),
      paymentDelayDays: z.number().int().min(0).default(0),
    })
    .optional(),
});

// --- POST /scenarios/simulate ---
scenarioRoutes.post("/simulate", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const data = simulateSchema.parse(body);

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
  const result = calculateFeasibility(input, data.adjustments);
  return c.json(success(result));
});

// --- GET /scenarios/presets ---
scenarioRoutes.get("/presets", authMiddleware, (c) => {
  return c.json(success(SCENARIO_PRESETS));
});

// --- POST /scenarios/switching-value ---
scenarioRoutes.post("/switching-value", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const input: FeasibilityInput = simulateSchema.parse(body);

  const all = calculateAllSwitchingValues(input);
  return c.json(success(all));
});
