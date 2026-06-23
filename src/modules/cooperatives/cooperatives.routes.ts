import { Hono } from "hono";
import { eq, ilike, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { cooperatives, producers, commodityBatches, marketplaceListings, orders } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { z } from "zod";

export const cooperativeRoutes = new Hono<AppEnv>();

const createCooperativeSchema = z.object({
  name: z.string().min(2),
  registrationNumber: z.string().optional(),
  villageName: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
});

// --- GET /cooperatives ---
cooperativeRoutes.get("/", async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const search = c.req.query("search");

  const conditions = [];
  if (search) {
    conditions.push(ilike(cooperatives.name, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(cooperatives)
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(cooperatives.createdAt),
    db
      .select({ count: sql<number>`count(*)` })
      .from(cooperatives)
      .where(where),
  ]);

  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /cooperatives ---
cooperativeRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin"),
  async (c) => {
    const body = await c.req.json();
    const data = createCooperativeSchema.parse(body);

    const [newCoop] = await db.insert(cooperatives).values(data).returning();

    return c.json(success(newCoop), 201);
  }
);

// --- GET /cooperatives/:id ---
cooperativeRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [coop] = await db
    .select()
    .from(cooperatives)
    .where(eq(cooperatives.id, id))
    .limit(1);

  if (!coop) {
    throw new NotFoundError("Cooperative", id);
  }

  // Get summary counts
  const [producerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(producers)
    .where(eq(producers.cooperativeId, id));

  const [batchCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commodityBatches)
    .where(eq(commodityBatches.cooperativeId, id));

  const [listingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketplaceListings)
    .where(eq(marketplaceListings.cooperativeId, id));

  const [orderCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.cooperativeId, id));

  return c.json(
    success({
      ...coop,
      summary: {
        producers: Number(producerCount.count),
        batches: Number(batchCount.count),
        listings: Number(listingCount.count),
        orders: Number(orderCount.count),
      },
    })
  );
});

// --- PATCH /cooperatives/:id ---
cooperativeRoutes.patch(
  "/:id",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = createCooperativeSchema.partial().parse(body);

    const [updated] = await db
      .update(cooperatives)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cooperatives.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Cooperative", id);
    }

    return c.json(success(updated));
  }
);
