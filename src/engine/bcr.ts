// Benefit-Cost Ratio = PV(benefits) / PV(costs).
// benefits and costs are parallel per-period streams; both discounted at annualRate.
// Returns 0 when costs are zero (avoids div-by-zero, NFR-004).

import { npv } from "./npv.js";

export function bcr(
  benefits: number[],
  costs: number[],
  annualRate: number
): number {
  const monthlyRate = annualRate / 12;
  const pvBenefits = npv(benefits, monthlyRate);
  const pvCosts = npv(costs, monthlyRate);
  if (pvCosts <= 0) return pvBenefits > 0 ? Infinity : 0;
  return pvBenefits / pvCosts;
}
