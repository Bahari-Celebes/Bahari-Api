import { Hono } from "hono";
import { eq, desc, and, gte } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { db } from "../../db/index.js";
import { commodityRecords, transactionRecords, weatherCache, cooperatives } from "../../db/schema/index.js";
import { success } from "../../lib/response.js";

export const predictionRoutes = new Hono<AppEnv>();

// ponytail: static heuristic predictions. Add ML model (seasonal ARIMA / LLM) when training data exceeds 12 months.

// --- GET /predictions/stock?cooperativeId=xxx ---
predictionRoutes.get("/stock", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  // Get current stock = sum of commodity records in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const records = await db
    .select()
    .from(commodityRecords)
    .where(and(eq(commodityRecords.cooperativeId, coopId), gte(commodityRecords.date, thirtyDaysAgo.toISOString().slice(0, 10))));

  // Heuristic: compare current volume with "ideal" stock based on weather + tx history
  const weather = await db
    .select()
    .from(weatherCache)
    .orderBy(desc(weatherCache.fetchedAt))
    .limit(7);

  const hasRain = weather.some(w => Number(w.rainfallMm ?? 0) > 20);
  const avgTemp = weather.length > 0 ? weather.reduce((s, w) => s + Number(w.temperature ?? 28), 0) / weather.length : 28;

  const recommendations = records.map(r => {
    const currentStock = Number(r.volume);
    // High spoilage risk if hot (>30°C) or rainy
    const spoilageRisk = (avgTemp > 30 && r.category === "ikan") || (hasRain) ? "high" : "normal";
    // Hot weather → higher demand for fresh fish → stock up
    const recommendedAction = avgTemp > 30 ? "Tambah stok (permintaan tinggi saat panas)" : hasRain ? "Kurangi stok (cuaca buruk, permintaan turun)" : "Stok normal";
    return {
      commodityName: r.commodityName,
      category: r.category,
      currentStock,
      unit: r.unit,
      spoilageRisk,
      recommendedAction,
    };
  });

  return c.json(success({ cooperativeId: coopId, weatherSnapshot: { avgTemp: Math.round(avgTemp), hasRain }, recommendations }));
});

// --- GET /predictions/harvest-risk?cooperativeId=xxx ---
predictionRoutes.get("/harvest-risk", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  const weather = await db.select().from(weatherCache).orderBy(desc(weatherCache.fetchedAt)).limit(7);
  const hasStorm = weather.some(w => Number(w.rainfallMm ?? 0) > 50);
  const hasRoughSeas = weather.some(w => Number(w.rainfallMm ?? 0) > 30 && Number(w.temperature ?? 28) < 26);

  const risks: any[] = [];

  if (hasStorm) {
    risks.push({ severity: "high", commodity: "Semua komoditas laut", message: "Cuaca buruk terdeteksi. Risiko gagal panen tinggi. Tunda melaut." });
  } else if (hasRoughSeas) {
    risks.push({ severity: "medium", commodity: "Ikan Tuna, Udang", message: "Gelombang tinggi. Produksi diperkirakan turun 30%." });
  }

  return c.json(success({ cooperativeId: coopId, risks, weatherSummary: { daysAnalyzed: weather.length, hasStorm, hasRoughSeas } }));
});
