import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";
import { commodityBatches } from "./commodity-batches";
import { orderItems } from "./order-items";

// --- Listing Status Enum ---
export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "active",
  "paused",
  "sold_out",
]);

// --- Marketplace Listings Table ---
export const marketplaceListings = pgTable("marketplace_listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  cooperativeId: uuid("cooperative_id").notNull().references(() => cooperatives.id),
  commodityBatchId: uuid("commodity_batch_id").notNull().references(() => commodityBatches.id),
  title: text("title").notNull(),
  description: text("description"),
  pricePerUnit: numeric("price_per_unit", { precision: 15, scale: 2 }).notNull(),
  availableQuantity: numeric("available_quantity", { precision: 12, scale: 2 }).notNull(),
  minimumOrder: numeric("minimum_order", { precision: 12, scale: 2 }),
  listingStatus: listingStatusEnum("listing_status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Marketplace Listings Relations ---
export const marketplaceListingsRelations = relations(marketplaceListings, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [marketplaceListings.cooperativeId],
    references: [cooperatives.id],
  }),
  commodityBatch: one(commodityBatches, {
    fields: [marketplaceListings.commodityBatchId],
    references: [commodityBatches.id],
  }),
  orderItems: many(orderItems),
}));
