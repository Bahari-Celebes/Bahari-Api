// Payback Period — months until cumulative cash flow recovers the initial investment.
// cashFlows[0] is the initial outflow (negative). Returns fractional months via
// linear interpolation across the crossing period. null if never recovered.

export function paybackPeriod(cashFlows: number[]): number | null {
  if (cashFlows.length < 2) return null;

  let cumulative = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    cumulative += cashFlows[t];
    if (cumulative >= 0 && t > 0) {
      // Crossed zero during period t. Interpolate fraction of period t.
      const prevCum = cumulative - cashFlows[t]; // cumulative before period t
      const needed = -prevCum; // amount period t must cover
      const fraction = needed / cashFlows[t];
      return t - 1 + fraction; // t-1 full periods elapsed + fraction of period t
    }
  }
  return null; // never pays back within horizon
}
