import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { commodityBatches, commodities, producers } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { z } from "zod";

export const batchRoutes = new Hono<AppEnv>();

const createBatchSchema = z.object({
  cooperativeId: z.string().uuid(),
  producerId: z.string().uuid(),
  commodityId: z.string().uuid(),
  quantity: z.string().or(z.number()).transform(String),
  unit: z.string().min(1),
  grade: z.string().optional(),
  productionDate: z.string().optional(),
  harvestLocation: z.string().optional(),
  basePrice: z.string().or(z.number()).transform(String).optional(),
  qualityStatus: z
    .enum(["fresh", "chilled", "frozen", "dried", "processed", "sorted", "packed"])
    .optional(),
  notes: z.string().optional(),
});

/**
 * Generate a unique batch code
 */
function generateBatchCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${date}-${random}`;
}

// --- GET /batches ---
batchRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const user = getCurrentUser(c);
  const cooperativeId = c.req.query("cooperative_id") || user.cooperativeId;
  const status = c.req.query("status");
  const commodityId = c.req.query("commodity_id");
  const producerId = c.req.query("producer_id");

  const conditions = [];
  if (cooperativeId) {
    conditions.push(eq(commodityBatches.cooperativeId, cooperativeId));
  }
  if (status) {
    conditions.push(eq(commodityBatches.status, status as any));
  }
  if (commodityId) {
    conditions.push(eq(commodityBatches.commodityId, commodityId));
  }
  if (producerId) {
    conditions.push(eq(commodityBatches.producerId, producerId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        batch: commodityBatches,
        commodityName: commodities.name,
        producerName: producers.name,
      })
      .from(commodityBatches)
      .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
      .leftJoin(producers, eq(commodityBatches.producerId, producers.id))
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(commodityBatches.createdAt),
    db
      .select({ count: sql<number>`count(*)` })
      .from(commodityBatches)
      .where(where),
  ]);

  const result = data.map((row) => ({
    ...row.batch,
    commodityName: row.commodityName,
    producerName: row.producerName,
  }));

  return c.json(paginated(result, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /batches ---
batchRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin", "producer"),
  async (c) => {
    const body = await c.req.json();
    const data = createBatchSchema.parse(body);

    const batchCode = generateBatchCode();

    const [newBatch] = await db
      .insert(commodityBatches)
      .values({
        ...data,
        batchCode,
        status: "submitted",
      })
      .returning();

    return c.json(success(newBatch), 201);
  }
);

// --- GET /batches/:id ---
batchRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const [result] = await db
    .select({
      batch: commodityBatches,
      commodityName: commodities.name,
      producerName: producers.name,
    })
    .from(commodityBatches)
    .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
    .leftJoin(producers, eq(commodityBatches.producerId, producers.id))
    .where(eq(commodityBatches.id, id))
    .limit(1);

  if (!result) {
    throw new NotFoundError("Commodity Batch", id);
  }

  return c.json(
    success({
      ...result.batch,
      commodityName: result.commodityName,
      producerName: result.producerName,
    })
  );
});

// --- PATCH /batches/:id/verify ---
batchRoutes.patch(
  "/:id/verify",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();

    const verifySchema = z.object({
      qualityStatus: z.enum(["fresh", "chilled", "frozen", "dried", "processed", "sorted", "packed"]),
      grade: z.string().optional(),
    });

    const data = verifySchema.parse(body);

    // Check current status
    const [batch] = await db
      .select()
      .from(commodityBatches)
      .where(eq(commodityBatches.id, id))
      .limit(1);

    if (!batch) {
      throw new NotFoundError("Commodity Batch", id);
    }

    if (batch.status !== "submitted") {
      throw new ValidationError(`Cannot verify batch with status '${batch.status}'. Only 'submitted' batches can be verified.`);
    }

    const [updated] = await db
      .update(commodityBatches)
      .set({
        status: "verified",
        qualityStatus: data.qualityStatus,
        grade: data.grade,
        updatedAt: new Date(),
      })
      .where(eq(commodityBatches.id, id))
      .returning();

    return c.json(success(updated));
  }
);
