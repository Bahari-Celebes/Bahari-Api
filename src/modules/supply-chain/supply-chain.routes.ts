import { Hono } from "hono";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { commodityRecords } from "../../db/schema";
import { success } from "../../lib/response";
import { calculateMargin, type MarginAnalysisInput } from "../../engine";

export const supplyChainRoutes = new Hono<AppEnv>();

// --- GET /supply-chain/analysis?cooperativeId=xxx ---
supplyChainRoutes.get("/analysis", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const cooperativeId = c.req.query("cooperativeId")!;
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");

  const conditions = [eq(commodityRecords.cooperativeId, cooperativeId)];
  if (dateFrom) conditions.push(gte(commodityRecords.date, dateFrom));
  if (dateTo) conditions.push(lte(commodityRecords.date, dateTo));
  const where = and(...conditions);

  const records = await db.select().from(commodityRecords).where(where);

  const perCommodity = records.map((r) => {
    const input: MarginAnalysisInput = {
      buyPrice: Number(r.buyPrice),
      sellPrice: Number(r.expectedSellPrice),
      actualSellPrice: r.actualSellPrice ? Number(r.actualSellPrice) : null,
      volume: Number(r.volume),
      logisticsCost: 0, // detailed logistics on transactions; use commodity-level as approximation.
      spoilageRate: Number(r.spoilagePercentage),
    };
    return { record: r, analysis: calculateMargin(input) };
  });

  // Aggregate
  const totalRevenue = perCommodity.reduce((s, c) => s + c.analysis.totalRevenue, 0);
  const totalCost = perCommodity.reduce((s, c) => s + c.analysis.totalCost, 0);
  const totalMargin = perCommodity.reduce((s, c) => s + c.analysis.margin, 0);
  const totalLeakage = perCommodity.reduce((s, c) => s + c.analysis.leakage, 0);
  const avgMarginPct = totalRevenue > 0 ? totalMargin / totalRevenue : 0;

  // Biggest leakage
  let biggestLeakage: { commodity: string; leakage: number } | null = null;
  for (const c of perCommodity) {
    if (!biggestLeakage || c.analysis.leakage > biggestLeakage.leakage) {
      biggestLeakage = { commodity: c.record.commodityName, leakage: c.analysis.leakage };
    }
  }

  // Value distribution: fisher share, cooperative margin, buyer cost
  const avgBuyPrice = records.reduce((s, r) => s + Number(r.buyPrice), 0) / (records.length || 1);
  const avgSellPrice = records.reduce((s, r) => s + Number(r.expectedSellPrice), 0) / (records.length || 1);

  return c.json(success({
    cooperativeId,
    perCommodity,
    summary: {
      totalRevenue,
      totalCost,
      totalMargin,
      totalLeakage,
      avgMarginPct,
      biggestLeakagePoint: biggestLeakage,
      valueDistribution: {
        fisherPrice: avgBuyPrice,
        cooperativeMargin: avgSellPrice - avgBuyPrice,
        buyerPrice: avgSellPrice,
      },
    },
  }));
});
