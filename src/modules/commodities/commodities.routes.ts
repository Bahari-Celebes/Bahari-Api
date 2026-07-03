import { Hono } from "hono";
import { eq, ilike, sql, and, gte, lte } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware, getCurrentUser } from "../../middleware/auth.js";
import { requireRole, assertCooperativeScope } from "../../middleware/rbac.js";
import { db } from "../../db/index.js";
import { commodityRecords } from "../../db/schema/index.js";
import { success, paginated, parsePagination, getOffset } from "../../lib/response.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { z } from "zod";

export const commodityRoutes = new Hono<AppEnv>();

const createSchema = z.object({
  cooperativeId: z.string().uuid(),
  commodityName: z.string().min(1),
  category: z.string().min(1),
  volume: z.number().positive(),
  unit: z.string().min(1),
  sourceGroup: z.string().min(1),
  buyPrice: z.number().positive(),
  expectedSellPrice: z.number().positive(),
  actualSellPrice: z.number().positive().optional(),
  spoilagePercentage: z.number().min(0).max(1).default(0),
  date: z.string(), // YYYY-MM-DD
});

const updateSchema = createSchema.partial().omit({ cooperativeId: true });

// --- GET /commodities ---
commodityRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const cooperativeId = c.req.query("cooperativeId");
  const category = c.req.query("category");
  const search = c.req.query("search");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");

  const conditions = [];
  if (cooperativeId) conditions.push(eq(commodityRecords.cooperativeId, cooperativeId));
  if (category) conditions.push(eq(commodityRecords.category, category));
  if (search) conditions.push(ilike(commodityRecords.commodityName, `%${search}%`));
  if (dateFrom) conditions.push(gte(commodityRecords.date, dateFrom));
  if (dateTo) conditions.push(lte(commodityRecords.date, dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(commodityRecords).where(where).limit(limit).offset(getOffset({ page, limit })).orderBy(commodityRecords.date),
    db.select({ count: sql<number>`count(*)` }).from(commodityRecords).where(where),
  ]);
  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /commodities ---
commodityRoutes.post("/", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();
  const data = createSchema.parse(body);
  assertCooperativeScope(user, data.cooperativeId);

  const insertData = {
    ...data,
    volume: String(data.volume),
    buyPrice: String(data.buyPrice),
    expectedSellPrice: String(data.expectedSellPrice),
    actualSellPrice: data.actualSellPrice !== undefined ? String(data.actualSellPrice) : undefined,
    spoilagePercentage: String(data.spoilagePercentage),
  };

  const [record] = await db.insert(commodityRecords).values(insertData).returning();
  return c.json(success(record), 201);
});

// --- GET /commodities/:id ---
commodityRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id") as string;
  const [record] = await db.select().from(commodityRecords).where(eq(commodityRecords.id, id)).limit(1);
  if (!record) throw new NotFoundError("CommodityRecord", id);
  return c.json(success(record));
});

// --- PATCH /commodities/:id ---
commodityRoutes.patch("/:id", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const id = c.req.param("id") as string;
  const body = await c.req.json();
  const data = updateSchema.parse(body);

  const [existing] = await db.select().from(commodityRecords).where(eq(commodityRecords.id, id)).limit(1);
  if (!existing) throw new NotFoundError("CommodityRecord", id);

  const { volume, buyPrice, expectedSellPrice, actualSellPrice, spoilagePercentage, ...rest } = data;
  const updateData = {
    ...rest,
    ...(volume !== undefined && { volume: String(volume) }),
    ...(buyPrice !== undefined && { buyPrice: String(buyPrice) }),
    ...(expectedSellPrice !== undefined && { expectedSellPrice: String(expectedSellPrice) }),
    ...(actualSellPrice !== undefined && { actualSellPrice: String(actualSellPrice) }),
    ...(spoilagePercentage !== undefined && { spoilagePercentage: String(spoilagePercentage) }),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(commodityRecords)
    .set(updateData)
    .where(eq(commodityRecords.id, id))
    .returning();
  return c.json(success(updated));
});

// --- DELETE /commodities/:id ---
commodityRoutes.delete("/:id", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  const id = c.req.param("id") as string;
  await db.delete(commodityRecords).where(eq(commodityRecords.id, id));
  return c.json(success({ deleted: true }));
});

// --- POST /commodities/import ---
commodityRoutes.post("/import", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();
  const rows = z.array(createSchema).parse(body.rows);

  const errors: { index: number; message: string }[] = [];
  const inserted: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      assertCooperativeScope(user, rows[i].cooperativeId);
      const row = rows[i];
      const insertData = {
        ...row,
        volume: String(row.volume),
        buyPrice: String(row.buyPrice),
        expectedSellPrice: String(row.expectedSellPrice),
        actualSellPrice: row.actualSellPrice !== undefined ? String(row.actualSellPrice) : undefined,
        spoilagePercentage: String(row.spoilagePercentage),
      };
      const [record] = await db.insert(commodityRecords).values(insertData).returning();
      inserted.push(record);
    } catch (e: any) {
      errors.push({ index: i, message: e.message });
    }
  }

  return c.json(success({ inserted: inserted.length, errors }));
});
