import { Hono } from "hono";
import { eq, ilike, sql, and, sum, avg, count } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { cooperatives, users, commodityRecords, transactionRecords } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { z } from "zod";

export const cooperativeRoutes = new Hono<AppEnv>();

const createSchema = z.object({
  name: z.string().min(2),
  village: z.string().min(1),
  region: z.string().min(1),
  totalMembers: z.number().int().min(0).default(0),
  activeMembers: z.number().int().min(0).default(0),
  mainCommodities: z.array(z.string()).default([]),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
});

const updateSchema = createSchema.partial();

// --- GET /cooperatives ---
cooperativeRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const search = c.req.query("search");
  const region = c.req.query("region");

  const conditions = [];
  if (search) conditions.push(ilike(cooperatives.name, `%${search}%`));
  if (region) conditions.push(eq(cooperatives.region, region));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(cooperatives).where(where).limit(limit).offset(getOffset({ page, limit })).orderBy(cooperatives.name),
    db.select({ count: sql<number>`count(*)` }).from(cooperatives).where(where),
  ]);

  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /cooperatives ---
cooperativeRoutes.post("/", authMiddleware, requireRole("admin"), async (c) => {
  const body = await c.req.json();
  const data = createSchema.parse(body);
  const [newCoop] = await db.insert(cooperatives).values(data).returning();
  return c.json(success(newCoop), 201);
});

// --- GET /cooperatives/:id ---
cooperativeRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id") as string;
  const [coop] = await db.select().from(cooperatives).where(eq(cooperatives.id, id)).limit(1);
  if (!coop) throw new NotFoundError("Cooperative", id);

  const [memberCount] = await db
    .select({ count: count() }).from(users).where(eq(users.cooperativeId, id));

  return c.json(success({ ...coop, memberCount: Number(memberCount?.count ?? 0) }));
});

// --- PATCH /cooperatives/:id ---
cooperativeRoutes.patch("/:id", authMiddleware, requireRole("admin", "cooperative_manager"), async (c) => {
  const id = c.req.param("id") as string;
  const body = await c.req.json();
  const data = updateSchema.parse(body);

  const [existing] = await db.select().from(cooperatives).where(eq(cooperatives.id, id)).limit(1);
  if (!existing) throw new NotFoundError("Cooperative", id);

  const [updated] = await db
    .update(cooperatives)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(cooperatives.id, id))
    .returning();
  return c.json(success(updated));
});

// --- GET /cooperatives/:id/baseline (FR-004) ---
cooperativeRoutes.get("/:id/baseline", authMiddleware, async (c) => {
  const id = c.req.param("id") as string;
  const [coop] = await db.select().from(cooperatives).where(eq(cooperatives.id, id)).limit(1);
  if (!coop) throw new NotFoundError("Cooperative", id);

  const [cmdStats] = await db
    .select({
      totalVolume: sum(sql`${commodityRecords.volume}::numeric`),
      avgBuyPrice: avg(sql`${commodityRecords.buyPrice}::numeric`),
      avgSellPrice: avg(sql`${commodityRecords.expectedSellPrice}::numeric`),
      avgSpoilage: avg(sql`${commodityRecords.spoilagePercentage}::numeric`),
      commodityCount: count(),
    })
    .from(commodityRecords)
    .where(eq(commodityRecords.cooperativeId, id));

  const [txStats] = await db
    .select({
      totalTxValue: sum(sql`${transactionRecords.grossValue}::numeric`),
      txCount: count(),
    })
    .from(transactionRecords)
    .where(eq(transactionRecords.cooperativeId, id));

  const totalVolume = Number(cmdStats?.totalVolume ?? 0);
  const totalTxValue = Number(txStats?.totalTxValue ?? 0);
  const avgBuyPrice = Number(cmdStats?.avgBuyPrice ?? 0);
  const avgSellPrice = Number(cmdStats?.avgSellPrice ?? 0);
  const sellPriceForMargin = avgSellPrice || avgBuyPrice;

  return c.json(success({
    cooperativeId: id,
    cooperativeName: coop.name,
    totalMembers: coop.totalMembers,
    activeMembers: coop.activeMembers,
    activeRatio: coop.totalMembers > 0 ? coop.activeMembers / coop.totalMembers : 0,
    totalVolume,
    totalTxValue,
    avgBuyPrice,
    avgSellPrice,
    spoilageRate: Number(cmdStats?.avgSpoilage ?? 0),
    marginPct: sellPriceForMargin > 0 ? (sellPriceForMargin - avgBuyPrice) / sellPriceForMargin : 0,
    commodityCount: Number(cmdStats?.commodityCount ?? 0),
    txCount: Number(txStats?.txCount ?? 0),
  }));
});
