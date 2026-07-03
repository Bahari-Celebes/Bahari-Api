// Switching value — the fractional change in a single variable at which the
// project flips from layak/waspada to tidak_layak. Iterative search (SRS 3.8).

import { calculateFeasibility } from "./feasibility";
import type {
  FeasibilityInput,
  ScenarioAdjustments,
  SwitchingValue,
} from "./types";
import { NO_ADJUSTMENT } from "./types";

type Variable = keyof ScenarioAdjustments;

const MAX_DELTA = 1; // search up to ±100% change
const STEPS = 50;

export function calculateSwitchingValue(
  input: FeasibilityInput,
  variable: Variable
): SwitchingValue {
  const baseline = calculateFeasibility(input, NO_ADJUSTMENT);
  const baselineStatus = baseline.status;

  // For revenue-like variables (price, volume), kita lower them (negative delta).
  // For cost-like variables (cost, spoilage, delay), kita raise them (positive delta).
  // Break-even = the magnitude that triggers tidak_layak.
  const isRevenueVar = variable === "priceAdjustment" || variable === "volumeAdjustment";

  // Direction of stress: revenues go down (negative), costs go up (positive).
  const stressSign = isRevenueVar ? -1 : +1;

  let breakEven: number | null = null;
  for (let i = 1; i <= STEPS; i++) {
    const magnitude = (i / STEPS) * MAX_DELTA;
    const adj: ScenarioAdjustments = { ...NO_ADJUSTMENT, [variable]: stressSign * magnitude };
    const result = calculateFeasibility(input, adj);
    if (result.status === "tidak_layak") {
      // Report as a signed break-even delta in the stress direction.
      breakEven = stressSign * magnitude;
      break;
    }
  }

  return { variable, breakEvenDelta: breakEven, baselineStatus };
}

export function calculateAllSwitchingValues(input: FeasibilityInput): SwitchingValue[] {
  const vars: Variable[] = [
    "priceAdjustment",
    "costAdjustment",
    "volumeAdjustment",
    "spoilageAdjustment",
    "paymentDelayDays",
  ];
  return vars.map((v) => calculateSwitchingValue(input, v));
}
