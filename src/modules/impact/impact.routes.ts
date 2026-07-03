import { Hono } from "hono";
import { eq, sql, and, count, sum } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { cooperatives, users, commodityRecords, transactionRecords } from "../../db/schema";
import { success } from "../../lib/response";

export const impactRoutes = new Hono<AppEnv>();

// --- GET /impact/metrics?cooperativeId=xxx ---
impactRoutes.get("/metrics", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const cooperativeId = c.req.query("cooperativeId")!;

  const [coop] = await db.select().from(cooperatives).where(eq(cooperatives.id, cooperativeId)).limit(1);
  if (!coop) return c.json(success({ message: "Cooperative not found" }), 404);

  const [cmdStats] = await db
    .select({
      totalVolume: sum(sql`${commodityRecords.volume}::numeric`),
      commodityCount: count(),
    })
    .from(commodityRecords)
    .where(eq(commodityRecords.cooperativeId, cooperativeId));

  const [txStats] = await db
    .select({
      totalTxValue: sum(sql`${transactionRecords.grossValue}::numeric`),
      txCount: count(),
    })
    .from(transactionRecords)
    .where(eq(transactionRecords.cooperativeId, cooperativeId));

  const [memberCount] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.cooperativeId, cooperativeId));

  const totalTxValue = Number(txStats?.totalTxValue ?? 0);
  const activeRatio = coop.totalMembers > 0 ? coop.activeMembers / coop.totalMembers : 0;

  // proxy tengkulak reduction: estimated share of cooperative-intermediated sales vs direct-middleman.
  // For MVP: if cooperative buys from fishermen, we assume 70% reduction in dependency.
  const tengkulakReductionPct = totalTxValue > 0 ? 0.7 : 0;

  // Local economic retention proxy: cooperative margin retained in village.
  const localRetention = totalTxValue * 0.15; // 15% margin proxy

  return c.json(
    success({
      cooperativeId,
      cooperativeName: coop.name,
      metrics: {
        txValueIncrease: {
          value: totalTxValue,
          label: "aktual",
          description: "Total nilai transaksi koperasi",
        },
        estimatedMemberIncome: {
          value: totalTxValue * 0.6 / Math.max(1, coop.activeMembers), // per-member estimate
          label: "estimasi",
          description: "Estimasi pendapatan per anggota aktif (60% dari nilai transaksi dibagi anggota)",
        },
        activeMemberRatio: {
          value: activeRatio,
          label: "aktual",
          description: "Rasio anggota aktif terhadap total anggota",
        },
        womenYouthInvolvement: {
          value: 0, // ponytail: placeholder, add when gender/age data exists
          label: "proyeksi",
          description: "Keterlibatan perempuan dan pemuda (data belum tersedia)",
        },
        tengkulakReduction: {
          value: tengkulakReductionPct,
          label: "estimasi",
          description: "Estimasi pengurangan ketergantungan pada tengkulak (proxy 70% jika koperasi aktif)",
        },
        localEconomicRetention: {
          value: localRetention,
          label: "estimasi",
          description: "Estimasi retensi ekonomi lokal (proxy 15% dari nilai transaksi)",
        },
      },
      memberCount: Number(memberCount?.count ?? 0),
      totalVolume: Number(cmdStats?.totalVolume ?? 0),
      totalTxValue,
      txCount: Number(txStats?.txCount ?? 0),
    })
  );
});
