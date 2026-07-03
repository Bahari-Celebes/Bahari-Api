import {
  pgTable,
  text,
  numeric,
  timestamp,
  date,
  uuid,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";
import { commodityRecords } from "./commodity-records";

export const paymentStatusEnum = pgEnum("payment_status", ["paid", "pending", "delayed"]);

// --- Transaction Records Table (SRS 3.6.4) ---
export const transactionRecords = pgTable(
  "transaction_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cooperativeId: uuid("cooperative_id").notNull(),
    commodityRecordId: uuid("commodity_record_id"), // nullable: some sales not tied to a record
    buyerType: text("buyer_type").notNull(), // restoran, hotel, retail, rumah_tangga
    volumeSold: numeric("volume_sold", { precision: 14, scale: 2 }).notNull(),
    sellingPrice: numeric("selling_price", { precision: 14, scale: 2 }).notNull(),
    grossValue: numeric("gross_value", { precision: 16, scale: 2 }).notNull(), // volumeSold * sellingPrice
    logisticsCost: numeric("logistics_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    storageCost: numeric("storage_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
    date: date("date").notNull(),
    syncVersion: integer("sync_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    coopIdx: index("transaction_records_coop_idx").on(t.cooperativeId),
    commodityIdx: index("transaction_records_commodity_idx").on(t.commodityRecordId),
    buyerIdx: index("transaction_records_buyer_idx").on(t.buyerType),
    payIdx: index("transaction_records_payment_idx").on(t.paymentStatus),
    dateIdx: index("transaction_records_date_idx").on(t.date),
  })
);

export const transactionRecordsRelations = relations(transactionRecords, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [transactionRecords.cooperativeId],
    references: [cooperatives.id],
  }),
  commodityRecord: one(commodityRecords, {
    fields: [transactionRecords.commodityRecordId],
    references: [commodityRecords.id],
  }),
}));
