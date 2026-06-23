import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";
import { producers } from "./producers";
import { commodities } from "./commodities";
import { marketplaceListings } from "./marketplace-listings";

// --- Batch Status Enum ---
export const batchStatusEnum = pgEnum("batch_status", [
  "submitted",
  "verified",
  "stored",
  "listed",
  "partially_sold",
  "sold",
  "cancelled",
]);

// --- Quality Status Enum ---
export const qualityStatusEnum = pgEnum("quality_status", [
  "fresh",
  "chilled",
  "frozen",
  "dried",
  "processed",
  "sorted",
  "packed",
]);

// --- Commodity Batches Table ---
export const commodityBatches = pgTable("commodity_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  cooperativeId: uuid("cooperative_id").notNull().references(() => cooperatives.id),
  producerId: uuid("producer_id").notNull().references(() => producers.id),
  commodityId: uuid("commodity_id").notNull().references(() => commodities.id),
  batchCode: text("batch_code").notNull().unique(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  grade: text("grade"),
  productionDate: date("production_date", { mode: "string" }),
  harvestLocation: text("harvest_location"),
  basePrice: numeric("base_price", { precision: 15, scale: 2 }),
  qualityStatus: qualityStatusEnum("quality_status"),
  status: batchStatusEnum("status").notNull().default("submitted"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Commodity Batches Relations ---
export const commodityBatchesRelations = relations(commodityBatches, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [commodityBatches.cooperativeId],
    references: [cooperatives.id],
  }),
  producer: one(producers, {
    fields: [commodityBatches.producerId],
    references: [producers.id],
  }),
  commodity: one(commodities, {
    fields: [commodityBatches.commodityId],
    references: [commodities.id],
  }),
  marketplaceListings: many(marketplaceListings),
}));
