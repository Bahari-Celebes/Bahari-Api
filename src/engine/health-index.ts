// Cooperative Health Index — scoring based on Kemenkop UKM financial ratios.
// Ponytail: simplified model. Add ML + time-series when enough data exists.

export interface HealthInput {
  currentAssets: number; // aset lancar
  currentLiabilities: number; // kewajiban lancar
  totalAssets: number;
  totalLiabilities: number;
  netIncome: number; // SHU
  totalRevenue: number;
  totalMembers: number;
  activeMembers: number;
}

export interface HealthResult {
  overallScore: number; // 0-100
  status: "sehat" | "perlu_perhatian" | "kritis";
  ratios: {
    liquidity: number; // current ratio: currentAssets / currentLiabilities
    solvability: number; // debt-to-asset: totalLiabilities / totalAssets (lower better)
    profitability: number; // net margin: netIncome / totalRevenue
    activity: number; // member participation: activeMembers / totalMembers
    memberRatio: number;
  };
  benchmarks: {
    liquidity: { ideal: number; score: number };
    solvability: { ideal: number; score: number };
    profitability: { ideal: number; score: number };
    activity: { ideal: number; score: number };
  };
}

// Kemenkop UKM ideal ratios
const IDEAL = {
  liquidityMin: 1.5, // current ratio >= 1.5 → sehat
  liquidityWarn: 1.0, // 1.0 - 1.5 → perlu perhatian
  solvabilityMax: 0.5, // debt-to-asset <= 0.5 → sehat
  solvabilityWarn: 0.8, // 0.5 - 0.8 → perlu perhatian
  profitabilityMin: 0.1, // net margin >= 10% → sehat
  profitabilityWarn: 0.03, // 3% - 10% → perlu perhatian
  activityMin: 0.7, // member participation >= 70% → sehat
  activityWarn: 0.4, // 40% - 70% → perlu perhatian
};

function scoreRatio(value: number, idealMin: number, warnMin: number, invert: boolean): number {
  const v = invert ? -value : value;
  const i = invert ? -idealMin : idealMin;
  const w = invert ? -warnMin : warnMin;

  if (v >= i) return 25; // full marks
  if (v >= w) return 15; // partial
  return 5; // poor
}

function scoreRatioMax(value: number, idealMax: number, warnMax: number): number {
  // Lower is better (solvability)
  if (value <= idealMax) return 25;
  if (value <= warnMax) return 15;
  return 5;
}

export function calculateHealthIndex(input: HealthInput): HealthResult {
  const liquidity = input.currentLiabilities > 0 ? input.currentAssets / input.currentLiabilities : 0;
  const solvability = input.totalAssets > 0 ? input.totalLiabilities / input.totalAssets : 0;
  const profitability = input.totalRevenue > 0 ? input.netIncome / input.totalRevenue : 0;
  const memberRatio = input.totalMembers > 0 ? input.activeMembers / input.totalMembers : 0;

  const sLiquidity = scoreRatio(liquidity, IDEAL.liquidityMin, IDEAL.liquidityWarn, false);
  const sSolvability = scoreRatioMax(solvability, IDEAL.solvabilityMax, IDEAL.solvabilityWarn);
  const sProfitability = scoreRatio(profitability, IDEAL.profitabilityMin, IDEAL.profitabilityWarn, false);
  const sActivity = scoreRatio(memberRatio, IDEAL.activityMin, IDEAL.activityWarn, false);

  const overallScore = sLiquidity + sSolvability + sProfitability + sActivity;

  let status: HealthResult["status"] = "kritis";
  if (overallScore >= 70) status = "sehat";
  else if (overallScore >= 45) status = "perlu_perhatian";

  return {
    overallScore,
    status,
    ratios: { liquidity, solvability, profitability, activity: memberRatio, memberRatio },
    benchmarks: {
      liquidity: { ideal: IDEAL.liquidityMin, score: sLiquidity },
      solvability: { ideal: IDEAL.solvabilityMax, score: sSolvability },
      profitability: { ideal: IDEAL.profitabilityMin, score: sProfitability },
      activity: { ideal: IDEAL.activityMin, score: sActivity },
    },
  };
}
