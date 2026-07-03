import {
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cooperatives } from "./cooperatives";

// --- Role Enum (BAHARI Intelligence) ---
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "cooperative_manager",
  "operator",
  "reviewer",
]);

// --- Users Table ---
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("reviewer"),
    cooperativeId: uuid("cooperative_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    roleIdx: index("users_role_idx").on(t.role),
    coopIdx: index("users_cooperative_idx").on(t.cooperativeId),
  })
);

// --- Users Relations ---
export const usersRelations = relations(users, ({ one }) => ({
  cooperative: one(cooperatives, {
    fields: [users.cooperativeId],
    references: [cooperatives.id],
  }),
}));
