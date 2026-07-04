import { pgTable, text, numeric, timestamp, uuid, index } from "drizzle-orm/pg-core";

// Cache harga eksternal (Bapanas/Kementan). TTL-based refresh.
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    commodityName: text("commodity_name").notNull(),
    source: text("source").notNull(), // bapanas, kementan, local
    region: text("region").notNull(),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    unit: text("unit").notNull().default("kg"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    commodityIdx: index("price_snapshots_commodity_idx").on(t.commodityName),
    sourceIdx: index("price_snapshots_source_idx").on(t.source),
    regionIdx: index("price_snapshots_region_idx").on(t.region),
    fetchedIdx: index("price_snapshots_fetched_idx").on(t.fetchedAt),
  })
);
