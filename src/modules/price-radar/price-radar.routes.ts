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

/** Seed price_snapshots from static benchmarks if table is empty */
async function ensureBenchmarksLoaded() {
  const existing = await db.select().from(priceSnapshots).limit(1);
  if (existing.length > 0) return;

  const data = staticBenchmarks();
  for (const b of data) {
    await db.insert(priceSnapshots).values({
      commodityName: b.commodityName,
      source: b.source,
      region: b.region,
      price: String(b.price),
      unit: b.unit,
      fetchedAt: new Date(b.fetchedAt),
    });
  }
}

/**
 * Fetch external price data from Bapanas / Kementan open data API.
 * ponytail: placeholder — Bapanas Panel Harga Pangan currently has no public REST API.
 * Replace with real endpoint when: https://panelharga.badanpangan.go.id/api is available,
 * or use https://hargapangan.id data scraper endpoint.
 *
 * Pattern: GET /some-api?commodity=ikan-tuna → [{ price, region, date }]
 */
async function fetchExternalPrices(): Promise<void> {
  // const BAPANAS_URL = process.env.BAPANAS_API_URL;
  // if (BAPANAS_URL) {
  //   const res = await fetch(`${BAPANAS_URL}/panel-harga-pangan`);
  //   const data = await res.json();
  //   // upsert into price_snapshots
  // }
  // ponytail: static benchmarks seeded on first request below.
  await ensureBenchmarksLoaded();
}

// --- GET /price-radar/compare?cooperativeId=xxx ---
priceRadarRoutes.get("/compare", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
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

  await fetchExternalPrices();
  const benchmarks = await db.select().from(priceSnapshots);

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

  await fetchExternalPrices();
  const benchmarks = await db.select().from(priceSnapshots);

  const alerts = comparePrices(localCommodities, benchmarks.map(b => ({
    commodityName: b.commodityName, source: b.source as any, region: b.region,
    price: Number(b.price), unit: b.unit, fetchedAt: b.fetchedAt?.toISOString() ?? new Date().toISOString(),
  })));

  const highAlerts = alerts.filter(a => a.severity === "high" || a.severity === "medium");

  return c.json(success({ alerts: highAlerts, totalAlerts: alerts.length, highCount: highAlerts.length }));
});

// --- POST /price-radar/refresh — force re-fetch external prices ---
priceRadarRoutes.post("/refresh", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  await ensureBenchmarksLoaded();
  return c.json(success({ refreshed: true, source: "static" }));
});
