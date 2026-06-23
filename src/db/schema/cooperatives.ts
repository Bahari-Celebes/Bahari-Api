import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { producers } from "./producers";
import { commodityBatches } from "./commodity-batches";
import { marketplaceListings } from "./marketplace-listings";
import { orders } from "./orders";
import { ecoPointTransactions } from "./eco-point-transactions";

// --- Cooperatives Table ---
export const cooperatives = pgTable("cooperatives", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  registrationNumber: text("registration_number").unique(),
  villageName: text("village_name"),
  district: text("district"),
  province: text("province"),
  address: text("address"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Cooperatives Relations ---
export const cooperativesRelations = relations(cooperatives, ({ many }) => ({
  producers: many(producers),
  commodityBatches: many(commodityBatches),
  marketplaceListings: many(marketplaceListings),
  orders: many(orders),
  ecoPointTransactions: many(ecoPointTransactions),
}));
