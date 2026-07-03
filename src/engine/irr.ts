// Internal Rate of Return — bisection solver over monthly cash flows.
// Returns the monthly IRR; multiply by 12 for annualized. null if no sign change (never converges).

import { npv } from "./npv";

export function irr(
  cashFlows: number[],
  opts: { guess?: number; maxIter?: number; tol?: number } = {}
): number | null {
  if (cashFlows.length < 2) return null;

  // Need at least one sign change for a real IRR.
  let hasPositive = false;
  let hasNegative = false;
  for (const cf of cashFlows) {
    if (cf > 0) hasPositive = true;
    if (cf < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) return null;

  const tol = opts.tol ?? 1e-6;
  const maxIter = opts.maxIter ?? 200;

  // Search the monthly-rate space [-0.99, 10] (≈ -99% to +1000%/mo). Bisection is
  // derivative-free and robust; Newton-Raphson can overshoot near flat regions.
  let lo = -0.99;
  let hi = 10;
  let fLo = npv(cashFlows, lo);
  let fHi = npv(cashFlows, hi);

  // Expand hi if NPV still positive at hi (rates this high make PV ~0, so NPV ≈ cashFlows[0] < 0 normally).
  if (fHi > 0) {
    // Project never crosses zero upward within sane range.
    if (fLo > 0) return null;
  }

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(cashFlows, mid);
    if (Math.abs(fMid) < tol || (hi - lo) / 2 < tol) {
      return mid;
    }
    // Preserve the bracket where the sign change lives.
    if (fMid * fLo < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}
