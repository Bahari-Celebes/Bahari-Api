// Price Arbitrage — compare local cooperative prices vs national/regional benchmarks.
// Pure TS, no deps. Based on Bapanas Panel Harga Pangan structure.

export interface PriceSnapshot {
  commodityName: string;
  source: "bapanas" | "kementan" | "local";
  region: string;
  price: number;
  unit: string;
  fetchedAt: string;
}

export interface ArbitrageAlert {
  commodityName: string;
  localPrice: number;
  benchmarkPrice: number;
  priceGap: number; // positive = local lebih mahal, bisa jual ke luar
  priceGapPct: number;
  direction: "jual_keluar" | "beli_dari_luar" | "normal";
  severity: "high" | "medium" | "low";
  targetRegion: string;
}

const HIGH_THRESHOLD = 0.15; // 15% gap → high opportunity
const MEDIUM_THRESHOLD = 0.08; // 8% gap → medium

export function comparePrices(
  localCommodities: Array<{ commodityName: string; buyPrice: number; sellPrice: number; unit: string }>,
  benchmarks: PriceSnapshot[]
): ArbitrageAlert[] {
  const alerts: ArbitrageAlert[] = [];

  for (const local of localCommodities) {
    // Find benchmarks for same commodity
    const sameCommodity = benchmarks.filter(
      (b) =>
        b.commodityName.toLowerCase().includes(local.commodityName.toLowerCase()) ||
        local.commodityName.toLowerCase().includes(b.commodityName.toLowerCase())
    );

    for (const bench of sameCommodity) {
      const gap = local.sellPrice - bench.price;
      const gapPct = bench.price > 0 ? gap / bench.price : 0;

      let direction: ArbitrageAlert["direction"] = "normal";
      let severity: ArbitrageAlert["severity"] = "low";

      if (gapPct > HIGH_THRESHOLD) {
        direction = "jual_keluar";
        severity = "high";
      } else if (gapPct > MEDIUM_THRESHOLD) {
        direction = "jual_keluar";
        severity = "medium";
      } else if (gapPct < -HIGH_THRESHOLD) {
        direction = "beli_dari_luar";
        severity = "high";
      } else if (gapPct < -MEDIUM_THRESHOLD) {
        direction = "beli_dari_luar";
        severity = "medium";
      }

      alerts.push({
        commodityName: local.commodityName,
        localPrice: local.sellPrice,
        benchmarkPrice: bench.price,
        priceGap: gap,
        priceGapPct: gapPct,
        direction,
        severity,
        targetRegion: bench.region,
      });
    }
  }

  return alerts.sort((a, b) => Math.abs(b.priceGapPct) - Math.abs(a.priceGapPct));
}

/** Generate static fallback benchmark data when Bapanas API is unavailable. */
export function staticBenchmarks(): PriceSnapshot[] {
  const now = new Date().toISOString();
  return [
    { commodityName: "Ikan Tuna Segar", source: "bapanas", region: "Nasional", price: 52000, unit: "kg", fetchedAt: now },
    { commodityName: "Ikan Tuna Segar", source: "bapanas", region: "Jawa Timur", price: 54000, unit: "kg", fetchedAt: now },
    { commodityName: "Rumput Laut Kering", source: "bapanas", region: "Nasional", price: 16000, unit: "kg", fetchedAt: now },
    { commodityName: "Udang Segar", source: "bapanas", region: "Nasional", price: 78000, unit: "kg", fetchedAt: now },
    { commodityName: "Udang Segar", source: "bapanas", region: "Jawa Timur", price: 80000, unit: "kg", fetchedAt: now },
    { commodityName: "Kerang Hijau", source: "kementan", region: "Nasional", price: 20000, unit: "kg", fetchedAt: now },
    { commodityName: "Ikan Olahan Asap", source: "kementan", region: "Nasional", price: 35000, unit: "kg", fetchedAt: now },
    { commodityName: "Ikan Kembung", source: "bapanas", region: "Nasional", price: 30000, unit: "kg", fetchedAt: now },
    { commodityName: "Cumi-cumi", source: "bapanas", region: "Nasional", price: 55000, unit: "kg", fetchedAt: now },
  ];
}
