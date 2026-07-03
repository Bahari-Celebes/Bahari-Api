import {
  pgTable,
  text,
  numeric,
  timestamp,
  date,
  uuid,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";
import { transactionRecords } from "./transaction-records";

// --- Commodity Records Table (SRS 3.6.3) ---
export const commodityRecords = pgTable(
  "commodity_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cooperativeId: uuid("cooperative_id").notNull(),
    commodityName: text("commodity_name").notNull(),
    category: text("category").notNull(), // ikan, rumput_laut, kerang, udang, olahan
    volume: numeric("volume", { precision: 14, scale: 2 }).notNull(),
    unit: text("unit").notNull(), // kg, ton, pack
    sourceGroup: text("source_group").notNull(),
    buyPrice: numeric("buy_price", { precision: 14, scale: 2 }).notNull(),
    expectedSellPrice: numeric("expected_sell_price", { precision: 14, scale: 2 }).notNull(),
    actualSellPrice: numeric("actual_sell_price", { precision: 14, scale: 2 }),
    spoilagePercentage: numeric("spoilage_percentage", { precision: 6, scale: 4 }).notNull().default("0"),
    date: date("date").notNull(),
    syncVersion: integer("sync_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    coopIdx: index("commodity_records_coop_idx").on(t.cooperativeId),
    nameIdx: index("commodity_records_name_idx").on(t.commodityName),
    categoryIdx: index("commodity_records_category_idx").on(t.category),
    dateIdx: index("commodity_records_date_idx").on(t.date),
  })
);

export const commodityRecordsRelations = relations(commodityRecords, ({ one, many }) => ({
  cooperative: one(cooperatives, {
    fields: [commodityRecords.cooperativeId],
    references: [cooperatives.id],
  }),
  transactions: many(transactionRecords),
}));
