import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { db } from "../../db";
import {
  producers,
  commodityBatches,
  marketplaceListings,
  orders,
  ecoPointTransactions,
  commodities,
} from "../../db/schema";
import { success } from "../../lib/response";

export const analyticsRoutes = new Hono<AppEnv>();

// --- GET /analytics/summary ---
analyticsRoutes.get("/summary", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const cooperativeId = c.req.query("cooperative_id") || user.cooperativeId;

  const coopFilter = cooperativeId
    ? eq(producers.cooperativeId, cooperativeId)
    : undefined;

  const [
    producerCount,
    batchCount,
    listingCount,
    orderCount,
    totalRevenue,
    totalEcoPoints,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(producers)
      .where(coopFilter),
    db
      .select({ count: sql<number>`count(*)` })
      .from(commodityBatches)
      .where(cooperativeId ? eq(commodityBatches.cooperativeId, cooperativeId) : undefined),
    db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceListings)
      .where(
        cooperativeId
          ? and(
              eq(marketplaceListings.cooperativeId, cooperativeId),
              eq(marketplaceListings.listingStatus, "active")
            )
          : eq(marketplaceListings.listingStatus, "active")
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(cooperativeId ? eq(orders.cooperativeId, cooperativeId) : undefined),
    db
      .select({ total: sql<number>`COALESCE(SUM(total_amount::numeric), 0)` })
      .from(orders)
      .where(
        cooperativeId
          ? and(
              eq(orders.cooperativeId, cooperativeId),
              eq(orders.status, "completed")
            )
          : eq(orders.status, "completed")
      ),
    db
      .select({ total: sql<number>`COALESCE(SUM(points), 0)` })
      .from(ecoPointTransactions)
      .where(
        cooperativeId
          ? and(
              eq(ecoPointTransactions.cooperativeId, cooperativeId),
              eq(ecoPointTransactions.status, "approved")
            )
          : eq(ecoPointTransactions.status, "approved")
      ),
  ]);

  return c.json(
    success({
      totalProducers: Number(producerCount[0].count),
      totalBatches: Number(batchCount[0].count),
      activeListings: Number(listingCount[0].count),
      totalOrders: Number(orderCount[0].count),
      totalRevenue: Number(totalRevenue[0].total),
      totalEcoPoints: Number(totalEcoPoints[0].total),
    })
  );
});

// --- GET /analytics/commodities ---
analyticsRoutes.get("/commodities", authMiddleware, async (c) => {
  const cooperativeId = c.req.query("cooperative_id") || getCurrentUser(c).cooperativeId;

  const conditions = [];
  if (cooperativeId) {
    conditions.push(eq(commodityBatches.cooperativeId, cooperativeId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select({
      commodityName: commodities.name,
      category: commodities.category,
      totalQuantity: sql<number>`COALESCE(SUM(${commodityBatches.quantity}::numeric), 0)`,
      batchCount: sql<number>`count(*)`,
    })
    .from(commodityBatches)
    .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
    .where(where)
    .groupBy(commodities.name, commodities.category);

  return c.json(success(data));
});

// --- GET /analytics/orders ---
analyticsRoutes.get("/orders", authMiddleware, async (c) => {
  const cooperativeId = c.req.query("cooperative_id") || getCurrentUser(c).cooperativeId;

  const conditions = [];
  if (cooperativeId) {
    conditions.push(eq(orders.cooperativeId, cooperativeId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select({
      status: orders.status,
      count: sql<number>`count(*)`,
      totalAmount: sql<number>`COALESCE(SUM(total_amount::numeric), 0)`,
    })
    .from(orders)
    .where(where)
    .groupBy(orders.status);

  return c.json(success(data));
});

// --- GET /analytics/producers ---
analyticsRoutes.get("/producers", authMiddleware, async (c) => {
  const cooperativeId = c.req.query("cooperative_id") || getCurrentUser(c).cooperativeId;

  const conditions = [];
  if (cooperativeId) {
    conditions.push(eq(producers.cooperativeId, cooperativeId));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const data = await db
    .select({
      producerType: producers.producerType,
      count: sql<number>`count(*)`,
    })
    .from(producers)
    .where(where)
    .groupBy(producers.producerType);

  return c.json(success(data));
});
