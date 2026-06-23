import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";
import { users } from "./users";
import { commodityBatches } from "./commodity-batches";
import { ecoPointTransactions } from "./eco-point-transactions";

// --- Producer Type Enum ---
export const producerTypeEnum = pgEnum("producer_type", [
  "fisherman",
  "fish_farmer",
  "seaweed_farmer",
  "salt_farmer",
  "coastal_farmer",
  "msme_processor",
  "women_group",
  "recycling_group",
  "community_group",
]);

// --- Producer Status Enum ---
export const producerStatusEnum = pgEnum("producer_status", [
  "active",
  "inactive",
  "suspended",
]);

// --- Producers Table ---
export const producers = pgTable("producers", {
  id: uuid("id").defaultRandom().primaryKey(),
  cooperativeId: uuid("cooperative_id").notNull().references(() => cooperatives.id),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  nik: text("nik"),
  phone: text("phone"),
  address: text("address"),
  producerType: producerTypeEnum("producer_type").notNull(),
  businessName: text("business_name"),
  productionArea: text("production_area"),
  productionAsset: text("production_asset"),
  memberNumber: text("member_number"),
  joinedAt: date("joined_at", { mode: "string" }),
  status: producerStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Producers Relations ---
export const producersRelations = relations(producers, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [producers.cooperativeId],
    references: [cooperatives.id],
  }),
  user: one(users, {
    fields: [producers.userId],
    references: [users.id],
  }),
  commodityBatches: many(commodityBatches),
  ecoPointTransactions: many(ecoPointTransactions),
}));
