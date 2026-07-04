import { pgTable, text, numeric, date, integer, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives.js";

export const healthScores = pgTable(
  "health_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cooperativeId: uuid("cooperative_id").notNull(),
    scoreDate: date("score_date").notNull(),
    overallScore: numeric("overall_score", { precision: 5, scale: 1 }).notNull(), // 0-100
    status: text("status").notNull(), // sehat, perlu_perhatian, kritis
    liquidityRatio: numeric("liquidity_ratio", { precision: 8, scale: 4 }),
    solvabilityRatio: numeric("solvability_ratio", { precision: 8, scale: 4 }),
    profitabilityRatio: numeric("profitability_ratio", { precision: 8, scale: 4 }),
    activityRatio: numeric("activity_ratio", { precision: 8, scale: 4 }),
    benchmarkRank: integer("benchmark_rank"),
    benchmarkTotal: integer("benchmark_total"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    coopIdx: index("health_scores_coop_idx").on(t.cooperativeId),
    dateIdx: index("health_scores_date_idx").on(t.scoreDate),
  })
);

export const healthScoresRelations = relations(healthScores, ({ one }) => ({
  cooperative: one(cooperatives, { fields: [healthScores.cooperativeId], references: [cooperatives.id] }),
}));