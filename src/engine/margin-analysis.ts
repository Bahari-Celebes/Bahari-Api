// Supply-chain margin analysis. Pure functions over per-commodity records.

import type { MarginAnalysisInput, MarginResult } from "./types";

export function calculateMargin(input: MarginAnalysisInput): MarginResult {
  const { buyPrice, sellPrice, actualSellPrice, volume, logisticsCost, spoilageRate } = input;
  const realizedSell = actualSellPrice ?? sellPrice;

  const priceSpread = sellPrice - buyPrice;
  const absorbedVolume = volume * (1 - spoilageRate);
  const unabsorbedVolume = volume * spoilageRate;

  const totalRevenue = absorbedVolume * realizedSell;
  const totalCost = buyPrice * volume + logisticsCost;
  const margin = totalRevenue - totalCost;
  const marginPct = totalRevenue > 0 ? margin / totalRevenue : 0;

  const spoilageImpact = unabsorbedVolume * sellPrice;
  const sellGap = (sellPrice - realizedSell) * absorbedVolume;
  const leakage = spoilageImpact + Math.max(0, sellGap);

  return {
    priceSpread,
    marginPerUnit: priceSpread,
    totalRevenue,
    totalCost,
    margin,
    marginPct,
    leakage,
    spoilageImpact,
    absorbedVolume,
    unabsorbedVolume,
  };
}

export function calculatePriceSpread(buyPrice: number, sellPrice: number): number {
  return sellPrice - buyPrice;
}

export function calculateLeakage(
  expectedSellPrice: number,
  actualSellPrice: number,
  volume: number
): number {
  return Math.max(0, expectedSellPrice - actualSellPrice) * volume;
}

export function calculateSpoilageImpact(
  volume: number,
  spoilageRate: number,
  pricePerUnit: number
): number {
  return volume * spoilageRate * pricePerUnit;
}
