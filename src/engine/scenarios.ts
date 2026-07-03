// Scenario presets (SRS FR-009): optimis, moderat, pesimis.
// Moderate = baseline (no adjustment). Optimis/pesimis per overview Modul 4.

import type { ScenarioAdjustments } from "./types";
import { NO_ADJUSTMENT } from "./types";

export interface ScenarioPreset {
  name: "optimis" | "moderat" | "pesimis";
  label: string;
  adjustments: ScenarioAdjustments;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    name: "optimis",
    label: "Optimis",
    adjustments: { priceAdjustment: 0.1, costAdjustment: -0.05, volumeAdjustment: 0, spoilageAdjustment: -0.02, paymentDelayDays: 0 },
  },
  {
    name: "moderat",
    label: "Moderat (Baseline)",
    adjustments: { ...NO_ADJUSTMENT },
  },
  {
    name: "pesimis",
    label: "Pesimis",
    adjustments: { priceAdjustment: -0.15, costAdjustment: 0.1, volumeAdjustment: 0, spoilageAdjustment: 0.05, paymentDelayDays: 14 },
  },
];
