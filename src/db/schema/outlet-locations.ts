import { pgTable, text, numeric, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives.js";

export const outletLocations = pgTable(
  "outlet_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cooperativeId: uuid("cooperative_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(), // warung, toko, cabang
    latitude: numeric("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: numeric("longitude", { precision: 10, scale: 7 }).notNull(),
    commoditiesSold: text("commodities_sold").array(),
    capacity: integer("capacity").default(100), // kg/hari
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    coopIdx: index("outlet_locations_coop_idx").on(t.cooperativeId),
  })
);

export const outletLocationsRelations = relations(outletLocations, ({ one }) => ({
  cooperative: one(cooperatives, { fields: [outletLocations.cooperativeId], references: [cooperatives.id] }),
}));
