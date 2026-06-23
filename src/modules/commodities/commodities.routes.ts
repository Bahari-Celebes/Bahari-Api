import { Hono } from "hono";
import { eq, ilike, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { commodities } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { z } from "zod";

export const commodityRoutes = new Hono<AppEnv>();

const createCommoditySchema = z.object({
  name: z.string().min(2),
  category: z.enum([
    "fresh_seafood", "aquaculture", "seaweed", "salt",
    "coastal_agriculture", "processed_food", "handicraft", "recycled_material",
  ]),
  unit: z.string().min(1),
  description: z.string().optional(),
  storageType: z
    .enum(["cold_storage", "chilled", "dry_storage", "room_temperature", "frozen", "none"])
    .default("none"),
});

// --- GET /commodities ---
commodityRoutes.get("/", async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const category = c.req.query("category");
  const search = c.req.query("search");

  const conditions = [];
  if (category) {
    conditions.push(eq(commodities.category, category as any));
  }
  if (search) {
    conditions.push(ilike(commodities.name, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(commodities).where(where).limit(limit).offset(getOffset({ page, limit })).orderBy(commodities.name),
    db.select({ count: sql<number>`count(*)` }).from(commodities).where(where),
  ]);

  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /commodities ---
commodityRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const body = await c.req.json();
    const data = createCommoditySchema.parse(body);

    const [newCommodity] = await db.insert(commodities).values(data).returning();

    return c.json(success(newCommodity), 201);
  }
);

// --- GET /commodities/:id ---
commodityRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [commodity] = await db
    .select()
    .from(commodities)
    .where(eq(commodities.id, id))
    .limit(1);

  if (!commodity) {
    throw new NotFoundError("Commodity", id);
  }

  return c.json(success(commodity));
});
