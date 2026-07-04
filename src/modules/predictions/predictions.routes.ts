import { Hono } from "hono";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { success } from "../../lib/response.js";

export const predictionRoutes = new Hono<AppEnv>();

// --- GET /predictions/stock?cooperativeId=xxx ---
predictionRoutes.get("/stock", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  // Built-in demo data — no DB dependency for MVP demo
  return c.json(success({
    cooperativeId: coopId,
    weatherSnapshot: { avgTemp: 30, hasRain: true },
    recommendations: [
      { commodityName: "Ikan Tuna Segar", category: "ikan", currentStock: 478, unit: "kg", spoilageRisk: "high", recommendedAction: "Kurangi stok (cuaca buruk, permintaan turun)" },
      { commodityName: "Rumput Laut Kering", category: "rumput_laut", currentStock: 356, unit: "kg", spoilageRisk: "normal", recommendedAction: "Stok normal" },
      { commodityName: "Udang Segar", category: "udang", currentStock: 412, unit: "kg", spoilageRisk: "high", recommendedAction: "Tambah stok (permintaan tinggi saat panas)" },
      { commodityName: "Kerang Hijau", category: "kerang", currentStock: 289, unit: "kg", spoilageRisk: "normal", recommendedAction: "Stok normal" },
      { commodityName: "Ikan Olahan Asap", category: "olahan", currentStock: 195, unit: "pack", spoilageRisk: "normal", recommendedAction: "Tambah stok (stok menipis)" },
    ],
  }));
});

// --- GET /predictions/harvest-risk?cooperativeId=xxx ---
predictionRoutes.get("/harvest-risk", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const coopId = c.req.query("cooperativeId")!;

  return c.json(success({
    cooperativeId: coopId,
    weatherSummary: { daysAnalyzed: 5, hasStorm: false, hasRoughSeas: true },
    risks: [
      { severity: "medium", commodity: "Ikan Tuna, Udang", message: "Gelombang tinggi 2-3m diprediksi besok. Produksi diperkirakan turun 30%." },
      { severity: "low", commodity: "Rumput Laut", message: "Hujan ringan — tidak berdampak signifikan pada panen." },
    ],
  }));
});
