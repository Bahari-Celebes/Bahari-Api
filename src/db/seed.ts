// BAHARI Intelligence demo seed (overview 4.8): 1 coastal coop, 4 user roles,
// 5 commodities, ~30 transactions, 3 feasibility scenarios with pre-computed results.
// Idempotent via reset-then-seed. Run: bun run db:seed
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, cooperatives, commodityRecords, transactionRecords, feasibilityScenarios } from "./schema/index.js";
import { hashPassword } from "../lib/password.js";
import { calculateFeasibility, type FeasibilityInput, NO_ADJUSTMENT } from "../engine/index.js";

const seedClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(seedClient);

async function main() {
  console.log("🌊 Seeding BAHARI Intelligence demo dataset...");

  // 1. Cooperatives
  const [coop] = await db.insert(cooperatives).values({
    name: "Koperasi Nelayan Bahari",
    village: "Desa Tanjung Biru",
    region: "Kabupaten Pesisir Selatan",
    totalMembers: 45,
    activeMembers: 32,
    mainCommodities: ["Ikan Tuna", "Rumput Laut", "Udang", "Kerang", "Ikan Olahan"],
    contactPerson: "Bapak Haji Rahman",
    phone: "081234567890",
  }).returning();

  // 2. Users
  const pw = await hashPassword("password123");
  await db.insert(users).values([
    { name: "Admin Bahari", email: "admin@bahari.id", passwordHash: pw, role: "admin" },
    { name: "Rahman Manager", email: "manager@bahari.id", passwordHash: pw, role: "cooperative_manager", cooperativeId: coop.id },
    { name: "Siti Operator", email: "operator@bahari.id", passwordHash: pw, role: "operator", cooperativeId: coop.id },
    { name: "Reviewer Dinas", email: "reviewer@bahari.id", passwordHash: pw, role: "reviewer", cooperativeId: coop.id },
  ]);

  // 3. Commodity records (5 commodities, 3 entries each = 15 records spread over 3 months)
  const commodities = [
    { name: "Ikan Tuna Segar", category: "ikan", unit: "kg", buyPrice: 45000, sellPrice: 58000, spoilage: 0.05, source: "Kelompok Nelayan Harapan" },
    { name: "Rumput Laut Kering", category: "rumput_laut", unit: "kg", buyPrice: 12000, sellPrice: 18000, spoilage: 0.03, source: "Kelompok Tani Pesisir" },
    { name: "Udang Segar", category: "udang", unit: "kg", buyPrice: 65000, sellPrice: 85000, spoilage: 0.08, source: "Kelompok Nelayan Maju" },
    { name: "Kerang Hijau", category: "kerang", unit: "kg", buyPrice: 15000, sellPrice: 22000, spoilage: 0.04, source: "Kelompok Pesisir Jaya" },
    { name: "Ikan Olahan Asap", category: "olahan", unit: "pack", buyPrice: 25000, sellPrice: 38000, spoilage: 0.02, source: "Kelompok Pengolah Mina" },
  ];

  const months = ["2026-04", "2026-05", "2026-06"];
  const commodityRecordsList: any[] = [];
  for (const c of commodities) {
    for (let m = 0; m < 3; m++) {
      const vol = Math.round((200 + Math.random() * 300) * 100) / 100;
      commodityRecordsList.push({
        cooperativeId: coop.id,
        commodityName: c.name,
        category: c.category,
        volume: String(vol),
        unit: c.unit,
        sourceGroup: c.source,
        buyPrice: String(c.buyPrice),
        expectedSellPrice: String(c.sellPrice),
        actualSellPrice: String(Math.round(c.sellPrice * (0.9 + Math.random() * 0.15))),
        spoilagePercentage: String(c.spoilage),
        date: `${months[m]}-15`,
      });
    }
  }
  const insertedCommodities = await db.insert(commodityRecords).values(commodityRecordsList).returning();

  // 4. Transaction records (~30 transactions across buyer types)
  const buyerTypes = ["restoran", "hotel", "retail", "rumah_tangga"];
  const paymentStatuses = ["paid", "pending", "delayed"] as const;
  const txList: any[] = [];

  for (let i = 0; i < 30; i++) {
    const cmd = insertedCommodities[i % insertedCommodities.length];
    const vol = Math.round((20 + Math.random() * 80) * 100) / 100;
    const sellingPrice = Math.round(Number(cmd.expectedSellPrice) * (0.85 + Math.random() * 0.25));
    const gross = Math.round(vol * sellingPrice);
    txList.push({
      cooperativeId: coop.id,
      commodityRecordId: cmd.id,
      buyerType: buyerTypes[i % 4],
      volumeSold: String(vol),
      sellingPrice: String(sellingPrice),
      grossValue: String(gross),
      logisticsCost: String(Math.round(gross * 0.05)),
      storageCost: String(Math.round(gross * 0.02)),
      paymentStatus: paymentStatuses[i % 3],
      date: `${months[i % 3]}-${String(5 + (i % 25)).padStart(2, "0")}`,
    });
  }
  await db.insert(transactionRecords).values(txList);

  // 5. Feasibility scenarios (pre-computed via engine)
  const feasibilityInput: FeasibilityInput = {
    capex: 50_000_000,
    monthlyOpex: 5_000_000,
    monthlyRevenue: 12_000_000,
    margin: 0.35,
    discountRate: 0.12,
    projectionMonths: 24,
    growthRate: 0.02,
    logisticsCost: 1_000_000,
    spoilageAssumption: 0.05,
  };

  const scenarios = [
    { name: "optimis", priceAdj: 0.1, costAdj: -0.05, spoilAdj: -0.02, delayDays: 0 },
    { name: "moderat", priceAdj: 0, costAdj: 0, spoilAdj: 0, delayDays: 0 },
    { name: "pesimis", priceAdj: -0.15, costAdj: 0.1, spoilAdj: 0.05, delayDays: 14 },
  ];

  for (const s of scenarios) {
    const result = calculateFeasibility(feasibilityInput, {
      priceAdjustment: s.priceAdj,
      costAdjustment: s.costAdj,
      volumeAdjustment: 0,
      spoilageAdjustment: s.spoilAdj,
      paymentDelayDays: s.delayDays,
    });
    await db.insert(feasibilityScenarios).values({
      cooperativeId: coop.id,
      scenarioName: s.name,
      capex: String(feasibilityInput.capex),
      monthlyOpex: String(feasibilityInput.monthlyOpex),
      monthlyRevenue: String(feasibilityInput.monthlyRevenue),
      margin: String(feasibilityInput.margin),
      discountRate: String(feasibilityInput.discountRate),
      growthRate: String(feasibilityInput.growthRate),
      projectionMonths: feasibilityInput.projectionMonths,
      logisticsCost: String(feasibilityInput.logisticsCost),
      spoilageAssumption: String(feasibilityInput.spoilageAssumption),
      priceAdjustment: String(s.priceAdj),
      costAdjustment: String(s.costAdj),
      spoilageAdjustment: String(s.spoilAdj),
      paymentDelayDays: s.delayDays,
      resultNpv: String(Math.round(result.npv)),
      resultIrr: result.irr !== null ? String(result.irr) : null,
      resultPaybackPeriod: result.paybackPeriod !== null ? String(result.paybackPeriod) : null,
      resultBcr: String(result.bcr),
      resultStatus: result.status,
    });
  }

  console.log("✅ BAHARI Intelligence seed complete!");
  console.log(`   - 1 cooperative: ${coop.name}`);
  console.log(`   - 4 users (admin / manager / operator / reviewer)`);
  console.log(`   - ${commodityRecordsList.length} commodity records`);
  console.log(`   - ${txList.length} transaction records`);
  console.log(`   - 3 feasibility scenarios (optimis/moderat/pesimis)`);
  await seedClient.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
