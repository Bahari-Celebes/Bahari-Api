import { Hono } from "hono";
import { eq, ilike, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { producers, cooperatives } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { z } from "zod";

export const producerRoutes = new Hono<AppEnv>();

const createProducerSchema = z.object({
  cooperativeId: z.string().uuid(),
  name: z.string().min(2),
  nik: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  producerType: z.enum([
    "fisherman", "fish_farmer", "seaweed_farmer", "salt_farmer",
    "coastal_farmer", "msme_processor", "women_group",
    "recycling_group", "community_group",
  ]),
  businessName: z.string().optional(),
  productionArea: z.string().optional(),
  productionAsset: z.string().optional(),
  memberNumber: z.string().optional(),
  joinedAt: z.string().optional(),
});

// --- GET /producers ---
producerRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const user = getCurrentUser(c);
  const cooperativeId = c.req.query("cooperative_id") || user.cooperativeId;
  const producerType = c.req.query("producer_type");
  const status = c.req.query("status");
  const search = c.req.query("search");

  const conditions = [];
  if (cooperativeId && user.role !== "super_admin") {
    conditions.push(eq(producers.cooperativeId, cooperativeId));
  } else if (cooperativeId) {
    conditions.push(eq(producers.cooperativeId, cooperativeId));
  }
  if (producerType) {
    conditions.push(eq(producers.producerType, producerType as any));
  }
  if (status) {
    conditions.push(eq(producers.status, status as any));
  }
  if (search) {
    conditions.push(ilike(producers.name, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(producers)
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(producers.createdAt),
    db
      .select({ count: sql<number>`count(*)` })
      .from(producers)
      .where(where),
  ]);

  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /producers ---
producerRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const body = await c.req.json();
    const data = createProducerSchema.parse(body);

    const [newProducer] = await db.insert(producers).values(data).returning();

    return c.json(success(newProducer), 201);
  }
);

// --- GET /producers/:id ---
producerRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const [producer] = await db
    .select()
    .from(producers)
    .where(eq(producers.id, id))
    .limit(1);

  if (!producer) {
    throw new NotFoundError("Producer", id);
  }

  return c.json(success(producer));
});

// --- PATCH /producers/:id ---
producerRoutes.patch(
  "/:id",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = createProducerSchema.partial().parse(body);

    const [updated] = await db
      .update(producers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(producers.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Producer", id);
    }

    return c.json(success(updated));
  }
);
