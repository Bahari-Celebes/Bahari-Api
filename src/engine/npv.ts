// Net Present Value.
// cashFlows[0] is the initial outflow (typically negative = investment).
// Convention: NPV = sum_{t} cashFlows[t] / (1+rate)^t  (capex already negative in flows).

export function npv(cashFlows: number[], rate: number): number {
  if (!cashFlows.length) return 0;
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return total;
}

/** Present value of a stream at annual rate, with per-month periods. */
export function presentValue(cashFlows: number[], annualRate: number): number {
  const monthlyRate = annualRate / 12;
  return npv(cashFlows, monthlyRate);
}
