import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { db } from "../../db/index.js";
import { commodityRecords, priceSnapshots } from "../../db/schema/index.js";
import { success } from "../../lib/response.js";
import { comparePrices, staticBenchmarks } from "../../engine/price-arbitrage.js";

export const priceRadarRoutes = new Hono<AppEnv>();

// --- GET /price-radar/compare?cooperativeId=xxx ---
priceRadarRoutes.get("/compare", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  // 1. Local commodity prices
  const localRecords = await db
    .select()
    .from(commodityRecords)
    .where(eq(commodityRecords.cooperativeId, coopId));

  const localCommodities = localRecords.map((r) => ({
    commodityName: r.commodityName,
    buyPrice: Number(r.buyPrice),
    sellPrice: Number(r.expectedSellPrice),
    unit: r.unit,
  }));

  // 2. Benchmark prices — from cached DB or static fallback
  let benchmarks = await db.select().from(priceSnapshots);

  if (benchmarks.length === 0) {
    // seed cache from static fallback
    const staticData = staticBenchmarks();
    for (const b of staticData) {
      await db.insert(priceSnapshots).values({
        commodityName: b.commodityName,
        source: b.source,
        region: b.region,
        price: String(b.price),
        unit: b.unit,
        fetchedAt: new Date(b.fetchedAt),
      });
    }
    benchmarks = await db.select().from(priceSnapshots);
  }

  const alerts = comparePrices(localCommodities, benchmarks.map(b => ({
    commodityName: b.commodityName,
    source: b.source as any,
    region: b.region,
    price: Number(b.price),
    unit: b.unit,
    fetchedAt: b.fetchedAt?.toISOString() ?? new Date().toISOString(),
  })));

  return c.json(success({
    cooperativeId: coopId,
    localCount: localCommodities.length,
    benchmarkCount: benchmarks.length,
    alerts,
    benchmarks: benchmarks.map(b => ({ commodityName: b.commodityName, source: b.source, region: b.region, price: Number(b.price), unit: b.unit })),
  }));
});

// --- GET /price-radar/alerts?cooperativeId=xxx ---
priceRadarRoutes.get("/alerts", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  const localRecords = await db
    .select()
    .from(commodityRecords)
    .where(eq(commodityRecords.cooperativeId, coopId));

  const localCommodities = localRecords.map((r) => ({
    commodityName: r.commodityName,
    buyPrice: Number(r.buyPrice),
    sellPrice: Number(r.expectedSellPrice),
    unit: r.unit,
  }));

  let benchmarks = await db.select().from(priceSnapshots);
  if (benchmarks.length === 0) {
    const staticData = staticBenchmarks();
    for (const b of staticData) {
      await db.insert(priceSnapshots).values({
        commodityName: b.commodityName, source: b.source, region: b.region,
        price: String(b.price), unit: b.unit, fetchedAt: new Date(b.fetchedAt),
      });
    }
    benchmarks = await db.select().from(priceSnapshots);
  }

  const alerts = comparePrices(localCommodities, benchmarks.map(b => ({
    commodityName: b.commodityName, source: b.source as any, region: b.region,
    price: Number(b.price), unit: b.unit, fetchedAt: b.fetchedAt?.toISOString() ?? new Date().toISOString(),
  })));

  const highAlerts = alerts.filter(a => a.severity === "high");

  return c.json(success({ alerts: highAlerts, totalAlerts: alerts.length, highCount: highAlerts.length }));
});
