import { Hono } from "hono";
import { eq, desc, sql, count, sum } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { db } from "../../db/index.js";
import { cooperatives, commodityRecords, transactionRecords, healthScores } from "../../db/schema/index.js";
import { success, paginated, parsePagination, getOffset } from "../../lib/response.js";
import { NotFoundError } from "../../lib/errors.js";
import { calculateHealthIndex, type HealthInput } from "../../engine/health-index.js";

export const healthIndexRoutes = new Hono<AppEnv>();

// --- GET /health-index/score?cooperativeId=xxx ---
healthIndexRoutes.get("/score", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;
  const [coop] = await db.select().from(cooperatives).where(eq(cooperatives.id, coopId)).limit(1);
  if (!coop) throw new NotFoundError("Cooperative", coopId);

  // Derive financial ratios from existing data
  const [txStats] = await db
    .select({ totalRevenue: sum(sql`${transactionRecords.grossValue}::numeric`), txCount: count() })
    .from(transactionRecords)
    .where(eq(transactionRecords.cooperativeId, coopId));

  const totalRevenue = Number(txStats?.totalRevenue ?? 0);

  // Simplified: use revenue as proxy for assets, assume conservative ratios
  const input: HealthInput = {
    currentAssets: totalRevenue * 0.3, // proxy: 30% inventory
    currentLiabilities: totalRevenue * 0.1, // proxy: 10% short-term debt
    totalAssets: totalRevenue * 1.5, // proxy: 1.5x revenue
    totalLiabilities: totalRevenue * 0.4, // proxy: 40% debt
    netIncome: totalRevenue * 0.15, // proxy: 15% margin
    totalRevenue,
    totalMembers: coop.totalMembers,
    activeMembers: coop.activeMembers,
  };

  const result = calculateHealthIndex(input);

  // Save score snapshot
  await db.insert(healthScores).values({
    cooperativeId: coopId,
    scoreDate: new Date().toISOString().slice(0, 10),
    overallScore: String(result.overallScore),
    status: result.status,
    liquidityRatio: String(result.ratios.liquidity),
    solvabilityRatio: String(result.ratios.solvability),
    profitabilityRatio: String(result.ratios.profitability),
    activityRatio: String(result.ratios.activity),
    benchmarkRank: null,
    benchmarkTotal: null,
  });

  return c.json(success({
    cooperativeId: coopId,
    cooperativeName: coop.name,
    ...result,
    input, // transparent proxies (NFR-005)
  }));
});

// --- GET /health-index/benchmark?cooperativeId=xxx ---
healthIndexRoutes.get("/benchmark", authMiddleware, async (c) => {
  // Return all coops' latest scores for comparison
  const latestScores = await db
    .select()
    .from(healthScores)
    .orderBy(desc(healthScores.scoreDate));

  // Group by cooperative, take latest
  const byCoop: Record<string, any[]> = {};
  for (const s of latestScores) {
    if (!byCoop[s.cooperativeId]) byCoop[s.cooperativeId] = [];
    if (byCoop[s.cooperativeId].length === 0) byCoop[s.cooperativeId].push(s);
  }

  const coops = await db.select({ id: cooperatives.id, name: cooperatives.name, region: cooperatives.region }).from(cooperatives);

  const benchmark = Object.values(byCoop).flat().map(s => {
    const coop = coops.find(c => c.id === s.cooperativeId);
    return {
      cooperativeId: s.cooperativeId,
      cooperativeName: coop?.name ?? "Unknown",
      region: coop?.region ?? "",
      overallScore: Number(s.overallScore),
      status: s.status,
      ratios: {
        liquidity: Number(s.liquidityRatio),
        solvability: Number(s.solvabilityRatio),
        profitability: Number(s.profitabilityRatio),
        activity: Number(s.activityRatio),
      },
    };
  });

  benchmark.sort((a, b) => b.overallScore - a.overallScore);

  return c.json(success({ benchmark, total: benchmark.length }));
});
