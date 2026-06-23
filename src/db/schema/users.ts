import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// --- Role Enum ---
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "cooperative_admin",
  "producer",
  "buyer",
]);

// --- Users Table ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("buyer"),
  cooperativeId: uuid("cooperative_id"),
  producerId: uuid("producer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Users Relations ---
export const usersRelations = relations(users, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [users.cooperativeId],
    references: [cooperatives.id],
  }),
}));

// Need forward reference — imported in index.ts
import { cooperatives } from "./cooperatives";
