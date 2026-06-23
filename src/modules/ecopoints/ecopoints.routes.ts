import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { ecoPointTransactions, producers } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { z } from "zod";

export const ecopointRoutes = new Hono<AppEnv>();

const createEcoPointSchema = z.object({
  producerId: z.string().uuid(),
  cooperativeId: z.string().uuid(),
  activityType: z.enum([
    "plastic_deposit", "coastal_cleanup", "waste_sorting",
    "mangrove_activity", "sustainable_production", "byproduct_reuse",
  ]),
  description: z.string().optional(),
  points: z.number().int().positive(),
  evidenceUrl: z.string().url().optional(),
});

// --- GET /ecopoints ---
ecopointRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const user = getCurrentUser(c);
  const cooperativeId = c.req.query("cooperative_id") || user.cooperativeId;
  const producerId = c.req.query("producer_id");
  const activityType = c.req.query("activity_type");

  const conditions = [];
  if (cooperativeId) {
    conditions.push(eq(ecoPointTransactions.cooperativeId, cooperativeId));
  }
  if (producerId) {
    conditions.push(eq(ecoPointTransactions.producerId, producerId));
  }
  if (activityType) {
    conditions.push(eq(ecoPointTransactions.activityType, activityType as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        ecoPoint: ecoPointTransactions,
        producerName: producers.name,
      })
      .from(ecoPointTransactions)
      .leftJoin(producers, eq(ecoPointTransactions.producerId, producers.id))
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(ecoPointTransactions.createdAt),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ecoPointTransactions)
      .where(where),
  ]);

  const result = data.map((row) => ({
    ...row.ecoPoint,
    producerName: row.producerName,
  }));

  return c.json(paginated(result, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /ecopoints ---
ecopointRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin", "producer"),
  async (c) => {
    const body = await c.req.json();
    const data = createEcoPointSchema.parse(body);

    const [newRecord] = await db
      .insert(ecoPointTransactions)
      .values({
        ...data,
        status: "pending",
      })
      .returning();

    return c.json(success(newRecord), 201);
  }
);
