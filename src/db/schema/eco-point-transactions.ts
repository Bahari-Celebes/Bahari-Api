import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { producers } from "./producers";
import { cooperatives } from "./cooperatives";

// --- Activity Type Enum ---
export const activityTypeEnum = pgEnum("eco_activity_type", [
  "plastic_deposit",
  "coastal_cleanup",
  "waste_sorting",
  "mangrove_activity",
  "sustainable_production",
  "byproduct_reuse",
]);

// --- Eco Point Status Enum ---
export const ecoPointStatusEnum = pgEnum("eco_point_status", [
  "pending",
  "approved",
  "rejected",
]);

// --- Eco Point Transactions Table ---
export const ecoPointTransactions = pgTable("eco_point_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  producerId: uuid("producer_id").notNull().references(() => producers.id),
  cooperativeId: uuid("cooperative_id").notNull().references(() => cooperatives.id),
  activityType: activityTypeEnum("activity_type").notNull(),
  description: text("description"),
  points: integer("points").notNull(),
  evidenceUrl: text("evidence_url"),
  status: ecoPointStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Eco Point Transactions Relations ---
export const ecoPointTransactionsRelations = relations(ecoPointTransactions, ({ one }) => ({
  producer: one(producers, {
    fields: [ecoPointTransactions.producerId],
    references: [producers.id],
  }),
  cooperative: one(cooperatives, {
    fields: [ecoPointTransactions.cooperativeId],
    references: [cooperatives.id],
  }),
}));
