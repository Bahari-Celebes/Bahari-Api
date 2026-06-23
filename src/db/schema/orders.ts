import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { cooperatives } from "./cooperatives";
import { orderItems } from "./order-items";

// --- Order Status Enum ---
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "packed",
  "ready_for_pickup",
  "delivered",
  "completed",
  "cancelled",
]);

// --- Orders Table ---
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  cooperativeId: uuid("cooperative_id").notNull().references(() => cooperatives.id),
  orderCode: text("order_code").notNull().unique(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  deliveryMethod: text("delivery_method"),
  buyerNotes: text("buyer_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Orders Relations ---
export const ordersRelations = relations(orders, ({ one, many }) => ({
  buyer: one(users, {
    fields: [orders.buyerId],
    references: [users.id],
  }),
  cooperative: one(cooperatives, {
    fields: [orders.cooperativeId],
    references: [cooperatives.id],
  }),
  items: many(orderItems),
}));
