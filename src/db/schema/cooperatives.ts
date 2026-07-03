import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.js";
import { commodityRecords } from "./commodity-records.js";
import { transactionRecords } from "./transaction-records.js";
import { feasibilityScenarios } from "./feasibility-scenarios.js";

// --- Cooperatives Table (SRS 3.6.2) ---
export const cooperatives = pgTable(
  "cooperatives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    village: text("village").notNull(),
    region: text("region").notNull(),
    totalMembers: integer("total_members").notNull().default(0),
    activeMembers: integer("active_members").notNull().default(0),
    mainCommodities: jsonb("main_commodities").$type<string[]>().default([]),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    villageIdx: index("cooperatives_village_idx").on(t.village),
    regionIdx: index("cooperatives_region_idx").on(t.region),
  })
);

// --- Cooperatives Relations ---
export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  users: many(users),
  commodityRecords: many(commodityRecords),
  transactionRecords: many(transactionRecords),
  feasibilityScenarios: many(feasibilityScenarios),
}));
