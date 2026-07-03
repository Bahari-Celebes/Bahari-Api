import { Hono } from "hono";
import { eq, ilike, sql, and, gte, lte } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole, assertCooperativeScope } from "../../middleware/rbac";
import { db } from "../../db";
import { transactionRecords } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError } from "../../lib/errors";
import { z } from "zod";

export const transactionRoutes = new Hono<AppEnv>();

const createSchema = z.object({
  cooperativeId: z.string().uuid(),
  commodityRecordId: z.string().uuid().optional(),
  buyerType: z.string().min(1),
  volumeSold: z.number().positive(),
  sellingPrice: z.number().positive(),
  logisticsCost: z.number().min(0).default(0),
  storageCost: z.number().min(0).default(0),
  paymentStatus: z.enum(["paid", "pending", "delayed"]).default("pending"),
  date: z.string(),
});

const updateSchema = createSchema.partial().omit({ cooperativeId: true });

// --- GET /transactions ---
transactionRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const cooperativeId = c.req.query("cooperativeId");
  const buyerType = c.req.query("buyerType");
  const paymentStatus = c.req.query("paymentStatus");
  const search = c.req.query("search");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");

  const conditions = [];
  if (cooperativeId) conditions.push(eq(transactionRecords.cooperativeId, cooperativeId));
  if (buyerType) conditions.push(eq(transactionRecords.buyerType, buyerType));
  if (paymentStatus) conditions.push(eq(transactionRecords.paymentStatus, paymentStatus as any));
  if (search) conditions.push(ilike(transactionRecords.buyerType, `%${search}%`));
  if (dateFrom) conditions.push(gte(transactionRecords.date, dateFrom));
  if (dateTo) conditions.push(lte(transactionRecords.date, dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.select().from(transactionRecords).where(where).limit(limit).offset(getOffset({ page, limit })).orderBy(transactionRecords.date),
    db.select({ count: sql<number>`count(*)` }).from(transactionRecords).where(where),
  ]);
  return c.json(paginated(data, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /transactions ---
transactionRoutes.post("/", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();
  const data = createSchema.parse(body);
  assertCooperativeScope(user, data.cooperativeId);

  const grossValue = data.volumeSold * data.sellingPrice;

  const insertData = {
    ...data,
    volumeSold: String(data.volumeSold),
    sellingPrice: String(data.sellingPrice),
    logisticsCost: String(data.logisticsCost),
    storageCost: String(data.storageCost),
    grossValue: String(grossValue),
  };

  const [record] = await db
    .insert(transactionRecords)
    .values(insertData)
    .returning();
  return c.json(success(record), 201);
});

// --- GET /transactions/:id ---
transactionRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id") as string;
  const [record] = await db.select().from(transactionRecords).where(eq(transactionRecords.id, id)).limit(1);
  if (!record) throw new NotFoundError("TransactionRecord", id);
  return c.json(success(record));
});

// --- PATCH /transactions/:id ---
transactionRoutes.patch("/:id", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const id = c.req.param("id") as string;
  const body = await c.req.json();
  const data = updateSchema.parse(body);

  const [existing] = await db.select().from(transactionRecords).where(eq(transactionRecords.id, id)).limit(1);
  if (!existing) throw new NotFoundError("TransactionRecord", id);

  // Recalculate grossValue if volume or price changed.
  const vol = data.volumeSold ?? existing.volumeSold;
  const price = data.sellingPrice ?? existing.sellingPrice;
  const grossValue = Number(vol) * Number(price);

  const { volumeSold, sellingPrice, logisticsCost, storageCost, ...rest } = data;
  const updateData = {
    ...rest,
    ...(volumeSold !== undefined && { volumeSold: String(volumeSold) }),
    ...(sellingPrice !== undefined && { sellingPrice: String(sellingPrice) }),
    ...(logisticsCost !== undefined && { logisticsCost: String(logisticsCost) }),
    ...(storageCost !== undefined && { storageCost: String(storageCost) }),
    grossValue: String(grossValue),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(transactionRecords)
    .set(updateData)
    .where(eq(transactionRecords.id, id))
    .returning();
  return c.json(success(updated));
});

// --- DELETE /transactions/:id ---
transactionRoutes.delete("/:id", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  const id = c.req.param("id") as string;
  await db.delete(transactionRecords).where(eq(transactionRecords.id, id));
  return c.json(success({ deleted: true }));
});

// --- POST /transactions/import ---
transactionRoutes.post("/import", authMiddleware, requireRole("cooperative_manager", "operator"), async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();
  const rows = z.array(createSchema).parse(body.rows);
  const errors: { index: number; message: string }[] = [];
  const inserted: any[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      assertCooperativeScope(user, rows[i].cooperativeId);
      const row = rows[i];
      const gross = row.volumeSold * row.sellingPrice;
      const insertData = {
        ...row,
        volumeSold: String(row.volumeSold),
        sellingPrice: String(row.sellingPrice),
        logisticsCost: String(row.logisticsCost),
        storageCost: String(row.storageCost),
        grossValue: String(gross),
      };
      const [record] = await db.insert(transactionRecords).values(insertData).returning();
      inserted.push(record);
    } catch (e: any) {
      errors.push({ index: i, message: e.message });
    }
  }
  return c.json(success({ inserted: inserted.length, errors }));
});
