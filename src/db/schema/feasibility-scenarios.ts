import {
  pgTable,
  text,
  numeric,
  integer,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";

// --- Feasibility Scenarios Table (SRS 3.6.5) ---
export const feasibilityScenarios = pgTable(
  "feasibility_scenarios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cooperativeId: uuid("cooperative_id").notNull(),
    scenarioName: text("scenario_name").notNull(), // optimis, moderat, pesimis, custom
    capex: numeric("capex", { precision: 16, scale: 2 }).notNull(),
    monthlyOpex: numeric("monthly_opex", { precision: 14, scale: 2 }).notNull(),
    monthlyRevenue: numeric("monthly_revenue", { precision: 14, scale: 2 }).notNull(),
    margin: numeric("margin", { precision: 6, scale: 4 }).notNull(),
    discountRate: numeric("discount_rate", { precision: 6, scale: 4 }).notNull(),
    growthRate: numeric("growth_rate", { precision: 6, scale: 4 }).notNull(),
    projectionMonths: integer("projection_months").notNull(),
    logisticsCost: numeric("logistics_cost", { precision: 14, scale: 2 }).notNull(),
    spoilageAssumption: numeric("spoilage_assumption", { precision: 6, scale: 4 }).notNull(),
    // Sensitivity deltas (nullable; null = baseline).
    priceAdjustment: numeric("price_adjustment", { precision: 6, scale: 4 }).default("0"),
    costAdjustment: numeric("cost_adjustment", { precision: 6, scale: 4 }).default("0"),
    volumeAdjustment: numeric("volume_adjustment", { precision: 6, scale: 4 }).default("0"),
    spoilageAdjustment: numeric("spoilage_adjustment", { precision: 6, scale: 4 }).default("0"),
    paymentDelayDays: integer("payment_delay_days").default(0),
    // Computed results (nullable until calculated).
    resultNpv: numeric("result_npv", { precision: 18, scale: 2 }),
    resultIrr: numeric("result_irr", { precision: 10, scale: 6 }),
    resultPaybackPeriod: numeric("result_payback_period", { precision: 10, scale: 4 }),
    resultBcr: numeric("result_bcr", { precision: 10, scale: 6 }),
    resultStatus: text("result_status"), // layak, waspada, tidak_layak
    syncVersion: integer("sync_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    coopIdx: index("feasibility_scenarios_coop_idx").on(t.cooperativeId),
    nameIdx: index("feasibility_scenarios_name_idx").on(t.scenarioName),
  })
);

export const feasibilityScenariosRelations = relations(feasibilityScenarios, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [feasibilityScenarios.cooperativeId],
    references: [cooperatives.id],
  }),
}));
