// Self-check for the engine. Run: `bun run packages/engine/src/self-check.ts`
// Assert-based, no test framework. Guards the math that money/decisions depend on.

import { npv } from "./npv";
import { irr } from "./irr";
import { bcr } from "./bcr";
import { paybackPeriod } from "./payback";
import { calculateMargin } from "./margin-analysis";
import { calculateFeasibility } from "./feasibility";
import { calculateAllSwitchingValues } from "./switching-value";
import { SCENARIO_PRESETS } from "./scenarios";
import type { FeasibilityInput } from "./types";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
}
function approx(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

// --- NPV: at rate 0, NPV = sum of flows ---
assert(approx(npv([-100, 50, 60, 10], 0), 20), "npv at r=0 = sum");
// Known: NPV of [-100,110] at 10% = -100 + 110/1.1 = 0
assert(approx(npv([-100, 110], 0.1), 0), "npv root example");

// --- IRR: rate that zeros NPV. [-100,110] -> 10% ---
assert(approx(irr([-100, 110])!, 0.1, 1e-4), "irr 10% root");
assert(irr([-100, -10, -5]) === null, "irr null when no sign change");
assert(irr([100]) === null, "irr null single flow");

// --- BCR: bcr takes ANNUAL rate, converts to monthly internally ---
assert(approx(bcr([0, 130], [100, 0], 0.1), 130 / (1 + 0.1 / 12) / 100), "bcr basic");
assert(bcr([100], [0], 0.1) === Infinity, "bcr Infinity when no cost");

// --- Payback ---
assert(approx(paybackPeriod([-100, 50, 60])!, 1 + 50 / 60), "payback 1.83y");
assert(paybackPeriod([-100, 10, 10, 10]) === null, "payback null never recovers");

// --- Margin: no spoilage, no logistics => margin = volume*(sell-buy) ---
{
  const m = calculateMargin({ buyPrice: 40, sellPrice: 50, volume: 100, logisticsCost: 0, spoilageRate: 0 });
  assert(approx(m.margin, 1000), "margin 1000");
  assert(approx(m.marginPct, 0.2), "margin 20%");
  assert(approx(m.unabsorbedVolume, 0), "no spoilage unabsorbed 0");
}
{
  const m = calculateMargin({ buyPrice: 40, sellPrice: 50, volume: 100, logisticsCost: 200, spoilageRate: 0.1 });
  // absorbed = 90, revenue = 90*50=4500, cost = 40*100+200=4200, margin=300
  assert(approx(m.margin, 300), "margin with spoilage+logistics");
  assert(approx(m.spoilageImpact, 10 * 50), "spoilage impact");
  assert(approx(m.unabsorbedVolume, 10), "unabsorbed 10");
}

// --- Feasibility: clearly profitable => layak ---
const good: FeasibilityInput = {
  capex: 50_000_000, monthlyOpex: 5_000_000, monthlyRevenue: 12_000_000,
  margin: 0.4, discountRate: 0.12, projectionMonths: 24, growthRate: 0.02,
  logisticsCost: 1_000_000, spoilageAssumption: 0.05,
};
const res = calculateFeasibility(good);
assert(res.npv > 0, "good npv > 0");
assert(res.bcr > 1, "good bcr > 1");
assert(res.status === "layak", `good status layak, got ${res.status}`);
assert(res.irr !== null && res.irr > 0, "good irr positive");
assert(res.paybackPeriod !== null && res.paybackPeriod < 24, "good payback < horizon");
assert(res.cashFlows.length === 25, "cashflows length = months+1");

// --- Feasibility: money-losing => tidak_layak ---
const bad: FeasibilityInput = { ...good, monthlyRevenue: 4_000_000, monthlyOpex: 5_000_000 };
const badRes = calculateFeasibility(bad);
assert(badRes.npv < 0, "bad npv < 0");
assert(badRes.status === "tidak_layak", `bad status tidak_layak, got ${badRes.status}`);

// --- NFR-004 safe handling: zero revenue, zero discount ---
{
  const r = calculateFeasibility({ ...good, monthlyRevenue: 0, discountRate: 0 });
  assert(!Number.isNaN(r.npv) && !Number.isNaN(r.bcr), "no NaN at zero inputs");
}

// --- Switching value: pessimistic stress should flip a marginal project ---
const marginal: FeasibilityInput = { ...good, monthlyRevenue: 9_000_000, projectionMonths: 18 };
const sv = calculateAllSwitchingValues(marginal);
assert(sv.length === 5, "5 switching variables");
assert(sv.every((s) => s.breakEvenDelta !== undefined), "all switching computed");

// --- Scenario presets: 3, moderat == no adjustment ---
assert(SCENARIO_PRESETS.length === 3, "3 presets");
assert(SCENARIO_PRESETS[1].adjustments.priceAdjustment === 0, "moderat baseline");
assert(SCENARIO_PRESETS[2].adjustments.priceAdjustment < 0, "pesimis revenue down");
assert(SCENARIO_PRESETS[0].adjustments.priceAdjustment > 0, "optimis revenue up");

console.log("✅ engine self-check passed (npv, irr, bcr, payback, margin, feasibility, switching, scenarios)");
