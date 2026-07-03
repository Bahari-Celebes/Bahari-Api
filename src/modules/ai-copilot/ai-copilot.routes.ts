import { Hono } from "hono";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware, getCurrentUser } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { success } from "../../lib/response.js";
import { z } from "zod";

export const aiCopilotRoutes = new Hono<AppEnv>();

const summarySchema = z.object({
  baseline: z.any(),
  supplyChain: z.any().optional(),
  feasibility: z.any().optional(),
  scenario: z.any().optional(),
  impact: z.any().optional(),
});

const recommendationSchema = z.object({
  feasibility: z.any(),
  scenario: z.any(),
  biggestRisk: z.string(),
});

const presentationSchema = z.object({
  baseline: z.any(),
  feasibility: z.any(),
  scenario: z.any(),
  impact: z.any(),
});

/**
 * Build a deterministic (no-LLM) summary from structured data. SRS 3.9 rule 8/9:
 * AI must only explain existing data; it must not invent numbers.
 * ponytail: structured template-based AI. Replace with LLM API call when API key is provisioned.
 */
function buildSummary(ctx: any): string {
  const b = ctx.baseline ?? {};
  const sc = ctx.supplyChain?.summary ?? {};
  return [
    `**Kondisi Koperasi ${b.cooperativeName ?? ""}:**`,
    `- Anggota: ${b.totalMembers ?? 0} total, ${b.activeMembers ?? 0} aktif (${((b.activeRatio ?? 0) * 100).toFixed(0)}%).`,
    `- Volume komoditas: ${Intl.NumberFormat("id-ID").format(b.totalVolume ?? 0)} kg.`,
    `- Nilai transaksi: Rp ${Intl.NumberFormat("id-ID").format(b.totalTxValue ?? 0)}.`,
    `- Harga beli rata-rata: Rp ${Intl.NumberFormat("id-ID").format(b.avgBuyPrice ?? 0)}/unit.`,
    `- Harga jual rata-rata: Rp ${Intl.NumberFormat("id-ID").format(b.avgSellPrice ?? 0)}/unit.`,
    `- Spoilage rate: ${((b.spoilageRate ?? 0) * 100).toFixed(1)}%.`,
    `- Margin koperasi: ${((b.marginPct ?? 0) * 100).toFixed(1)}%.`,
    ``,
    `${sc.totalLeakage ? `**Kebocoran margin terbesar:** Rp ${Intl.NumberFormat("id-ID").format(sc.totalLeakage)} pada komoditas ${ctx.supplyChain?.summary?.biggestLeakagePoint?.commodity ?? "tidak diketahui"}.` : ""}`,
  ].join("\n");
}

function buildRecommendation(ctx: any): string {
  const f = ctx.feasibility ?? {};
  const status = f.status ?? "tidak diketahui";
  const risk = ctx.biggestRisk ?? "fluktuasi harga";
  const recs = [
    `1. **${status === "layak" ? "Lanjutkan investasi** dengan pemantauan margin bulanan." : status === "waspada" ? "Kaji ulang asumsi** dan identifikasi efisiensi biaya." : "Tunda investasi** sampai margin koperasi membaik."}`,
    `2. **Mitigasi risiko ${risk}:** siapkan dana cadangan dan diversifikasi buyer.`,
    `3. **Optimalkan logistik** untuk menekan biaya distribusi.`,
    `4. **Kurangi spoilage** melalui cold storage atau penjadwalan pengiriman yang lebih baik.`,
    `5. **Edukasi anggota** tentang standar kualitas untuk meningkatkan harga jual.`,
  ];
  return `**Risiko Utama:** ${risk}\n\n**Rekomendasi Tindakan:**\n${recs.join("\n")}`;
}

function buildPresentation(ctx: any): string {
  const b = ctx.baseline ?? {};
  const f = ctx.feasibility ?? {};
  return [
    `**Ringkasan untuk Rapat Anggota**`,
    ``,
    `Koperasi ${b.cooperativeName ?? "Kita"} saat ini memiliki ${b.totalMembers ?? 0} anggota (${b.activeMembers ?? 0} aktif).`,
    `Total nilai transaksi mencapai Rp ${Intl.NumberFormat("id-ID").format(b.totalTxValue ?? 0)}.`,
    ``,
    `Hasil analisis kelayakan usaha:`,
    `- NPV: Rp ${Intl.NumberFormat("id-ID").format(f.npv ?? 0)}`,
    `- IRR: ${((f.irr ?? 0) * 100).toFixed(1)}%`,
    `- Payback Period: ${f.paybackPeriod !== null ? f.paybackPeriod.toFixed(1) + " bulan" : "tidak dalam horizon"}`,
    `- BCR: ${(f.bcr ?? 0).toFixed(2)}`,
    `- Status: **${f.status?.toUpperCase() ?? "?"}**`,
    ``,
    `Rekomendasi: ${f.status === "layak" ? "Usaha layak dilanjutkan dengan monitoring ketat." : f.status === "waspada" ? "Perlu perbaikan efisiensi sebelum ekspansi." : "Tunda investasi sampai kondisi membaik."}`,
  ].join("\n");
}

// --- POST /ai/summary ---
aiCopilotRoutes.post("/summary", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const data = summarySchema.parse(body);
  const summary = buildSummary(data);
  return c.json(success({ summary, source: "structured" }));
});

// --- POST /ai/recommendation ---
aiCopilotRoutes.post("/recommendation", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const data = recommendationSchema.parse(body);
  const recommendation = buildRecommendation(data);
  return c.json(success({ recommendation, source: "structured" }));
});

// --- POST /ai/presentation-summary ---
aiCopilotRoutes.post("/presentation-summary", authMiddleware, requireRole("cooperative_manager", "reviewer"), async (c) => {
  const body = await c.req.json();
  const data = presentationSchema.parse(body);
  const summary = buildPresentation(data);
  return c.json(success({ summary, source: "structured" }));
});
