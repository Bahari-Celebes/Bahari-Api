// BAHARI Intelligence — calculation engine types.
// Pure TS, no Node deps. Shared by backend + browser (offline).

export type FeasibilityStatus = "layak" | "waspada" | "tidak_layak";

/** Inputs for a feasibility projection. All monetary values in IDR. */
export interface FeasibilityInput {
  capex: number; // initial investment (IDR)
  monthlyOpex: number; // operating cost per month (IDR)
  monthlyRevenue: number; // revenue per month before adjustments (IDR)
  margin: number; // baseline gross margin fraction, e.g. 0.2 = 20%
  discountRate: number; // annual discount rate fraction, e.g. 0.1 = 10%
  projectionMonths: number; // projection horizon (months)
  growthRate: number; // monthly revenue growth fraction, e.g. 0.02
  logisticsCost: number; // monthly logistics cost (IDR)
  spoilageAssumption: number; // spoilage fraction of revenue, e.g. 0.05
}

/** Sensitivity adjustments as fractional deltas from baseline (0 = no change). */
export interface ScenarioAdjustments {
  priceAdjustment: number; // revenue multiplier delta, e.g. -0.15 = -15%
  costAdjustment: number; // opex multiplier delta
  volumeAdjustment: number; // volume/revenue multiplier delta
  spoilageAdjustment: number; // absolute spoilage delta, e.g. +0.05
  paymentDelayDays: number; // buyer payment delay (days)
}

export const NO_ADJUSTMENT: ScenarioAdjustments = {
  priceAdjustment: 0,
  costAdjustment: 0,
  volumeAdjustment: 0,
  spoilageAdjustment: 0,
  paymentDelayDays: 0,
};

export interface FeasibilityResult {
  npv: number;
  irr: number | null; // null when IRR does not converge
  paybackPeriod: number | null; // months, null when never pays back
  bcr: number;
  status: FeasibilityStatus;
  cashFlows: number[]; // per-month net cash flow (index 0 = -capex)
  cumulativeCashFlows: number[];
  assumptions: FeasibilityInput; // echoed for transparency (NFR-005)
}

export interface SwitchingValue {
  variable: keyof ScenarioAdjustments;
  /** Fractional change from baseline at which the project flips to tidak_layak.
   *  Positive = revenue can fall this much; negative = cost can rise this much. */
  breakEvenDelta: number | null; // null = never becomes tidak_layak within search range
  baselineStatus: FeasibilityStatus;
}

export interface MarginAnalysisInput {
  buyPrice: number; // price paid to fisher (per unit)
  sellPrice: number; // expected sell price to buyer (per unit)
  actualSellPrice?: number | null; // realized sell price (per unit)
  volume: number;
  logisticsCost: number; // total logistics cost
  spoilageRate: number; // fraction spoiled, e.g. 0.05
}

export interface MarginResult {
  priceSpread: number; // sellPrice - buyPrice (per unit)
  marginPerUnit: number; // priceSpread (before costs)
  totalRevenue: number; // volume * sellPrice * (1 - spoilage)
  totalCost: number; // buyPrice*volume + logisticsCost
  margin: number; // totalRevenue - totalCost
  marginPct: number; // margin / totalRevenue
  leakage: number; // value lost to spoilage + (expected - actual) sell gap
  spoilageImpact: number; // volume * spoilageRate * sellPrice
  absorbedVolume: number; // volume * (1 - spoilageRate)
  unabsorbedVolume: number; // volume * spoilageRate
}
