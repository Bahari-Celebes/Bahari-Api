// Feasibility orchestrator. Builds monthly cash flows from inputs (+optional
// scenario adjustments), then runs NPV / IRR / BCR / Payback. Applies the
// layak/waspada/tidak_layak status rule (SRS 3.7 rule 5).

import { npv } from "./npv.js";
import { irr } from "./irr.js";
import { bcr } from "./bcr.js";
import { paybackPeriod } from "./payback.js";
import type {
  FeasibilityInput,
  FeasibilityResult,
  FeasibilityStatus,
  ScenarioAdjustments,
} from "./types.js";
import { NO_ADJUSTMENT } from "./types.js";

export interface CashFlowBuild {
  net: number[]; // index 0 = -capex, then monthly net
  benefits: number[];
  costs: number[];
}

/** Build monthly cash-flow arrays from inputs and adjustments. */
export function buildCashFlows(
  input: FeasibilityInput,
  adj: ScenarioAdjustments = NO_ADJUSTMENT
): CashFlowBuild {
  const monthlyRate = input.discountRate / 12;

  // Apply sensitivity multipliers.
  const revenueFactor = 1 + adj.priceAdjustment + adj.volumeAdjustment;
  const opexFactor = 1 + adj.costAdjustment;
  const spoilage = Math.max(0, input.spoilageAssumption + adj.spoilageAdjustment);

  const net: number[] = [-input.capex];
  const benefits: number[] = [0];
  const costs: number[] = [input.capex];

  for (let m = 1; m <= input.projectionMonths; m++) {
    const growth = Math.pow(1 + input.growthRate, m - 1);
    const grossRevenue = input.monthlyRevenue * revenueFactor * growth;
    const revenue = grossRevenue * (1 - spoilage);
    const opex = input.monthlyOpex * opexFactor;
    const netFlow = revenue - opex - input.logisticsCost;
    net.push(netFlow);
    benefits.push(revenue);
    costs.push(opex + input.logisticsCost);
  }

  // Payment delay: defer net inflow by N days (≈ N/30 of a period). Modeled as a
  // carrying cost = delayed portion * monthlyRate * delayFraction (simple proxy).
  // ponytail: approximate delay as financing cost; full time-shift of flows if precision matters.
  if (adj.paymentDelayDays > 0) {
    const delayFraction = adj.paymentDelayDays / 30;
    for (let m = 1; m <= input.projectionMonths; m++) {
      const carrying = Math.max(0, net[m]) * monthlyRate * delayFraction;
      net[m] -= carrying;
      costs[m] += carrying;
    }
  }

  return { net, benefits, costs };
}

function classifyStatus(
  npvVal: number,
  bcrVal: number,
  pp: number | null,
  projectionMonths: number
): FeasibilityStatus {
  // SRS 3.7 rule 5: layak if NPV>0, BCR>1, payback within horizon.
  const ppOk = pp !== null && pp <= projectionMonths;
  if (npvVal > 0 && bcrVal > 1 && ppOk) return "layak";
  if (npvVal > 0 || bcrVal > 1) return "waspada";
  return "tidak_layak";
}

export function calculateFeasibility(
  input: FeasibilityInput,
  adj: ScenarioAdjustments = NO_ADJUSTMENT
): FeasibilityResult {
  const { net, benefits, costs } = buildCashFlows(input, adj);

  const monthlyRate = input.discountRate / 12;
  const npvVal = npv(net, monthlyRate);
  const irrMonthly = irr(net);
  const irrAnnual = irrMonthly !== null ? irrMonthly * 12 : null;
  const bcrVal = bcr(benefits, costs, input.discountRate);
  const pp = paybackPeriod(net);

  // Cumulative for charting.
  const cumulative: number[] = [];
  let acc = 0;
  for (const f of net) {
    acc += f;
    cumulative.push(acc);
  }

  const status = classifyStatus(npvVal, bcrVal, pp, input.projectionMonths);

  return {
    npv: npvVal,
    irr: irrAnnual,
    paybackPeriod: pp,
    bcr: bcrVal,
    status,
    cashFlows: net,
    cumulativeCashFlows: cumulative,
    assumptions: input,
  };
}
