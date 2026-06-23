import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { commodityBatches } from "./commodity-batches";

// --- Commodity Category Enum ---
export const commodityCategoryEnum = pgEnum("commodity_category", [
  "fresh_seafood",
  "aquaculture",
  "seaweed",
  "salt",
  "coastal_agriculture",
  "processed_food",
  "handicraft",
  "recycled_material",
]);

// --- Storage Type Enum ---
export const storageTypeEnum = pgEnum("storage_type", [
  "cold_storage",
  "chilled",
  "dry_storage",
  "room_temperature",
  "frozen",
  "none",
]);

// --- Commodities Table ---
export const commodities = pgTable("commodities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  category: commodityCategoryEnum("category").notNull(),
  unit: text("unit").notNull(), // e.g., kg, liter, pcs
  description: text("description"),
  storageType: storageTypeEnum("storage_type").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Commodities Relations ---
export const commoditiesRelations = relations(commodities, ({ many }) => ({
  commodityBatches: many(commodityBatches),
}));
