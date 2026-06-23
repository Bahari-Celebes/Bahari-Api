import { Hono } from "hono";
import { eq, sql, and, desc, asc } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { marketplaceListings, commodityBatches, cooperatives, commodities } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { z } from "zod";

export const listingRoutes = new Hono<AppEnv>();

const createListingSchema = z.object({
  cooperativeId: z.string().uuid(),
  commodityBatchId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  pricePerUnit: z.string().or(z.number()).transform(String),
  availableQuantity: z.string().or(z.number()).transform(String),
  minimumOrder: z.string().or(z.number()).transform(String).optional(),
});

// --- GET /listings (public) ---
listingRoutes.get("/", async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const status = c.req.query("listing_status") || "active";
  const cooperativeId = c.req.query("cooperative_id");
  const category = c.req.query("category");

  const conditions = [];
  conditions.push(eq(marketplaceListings.listingStatus, status as any));
  if (cooperativeId) {
    conditions.push(eq(marketplaceListings.cooperativeId, cooperativeId));
  }
  if (category) {
    conditions.push(eq(commodities.category, category as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        listing: marketplaceListings,
        cooperativeName: cooperatives.name,
        commodityName: commodities.name,
        commodityCategory: commodities.category,
        qualityStatus: commodityBatches.qualityStatus,
      })
      .from(marketplaceListings)
      .leftJoin(cooperatives, eq(marketplaceListings.cooperativeId, cooperatives.id))
      .leftJoin(commodityBatches, eq(marketplaceListings.commodityBatchId, commodityBatches.id))
      .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(desc(marketplaceListings.createdAt)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceListings)
      .leftJoin(commodityBatches, eq(marketplaceListings.commodityBatchId, commodityBatches.id))
      .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
      .where(where),
  ]);

  const result = data.map((row) => ({
    ...row.listing,
    cooperativeName: row.cooperativeName,
    commodityName: row.commodityName,
    commodityCategory: row.commodityCategory,
    qualityStatus: row.qualityStatus,
  }));

  return c.json(paginated(result, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /listings ---
listingRoutes.post(
  "/",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const body = await c.req.json();
    const data = createListingSchema.parse(body);

    // Verify batch exists and is verified/stored
    const [batch] = await db
      .select()
      .from(commodityBatches)
      .where(eq(commodityBatches.id, data.commodityBatchId))
      .limit(1);

    if (!batch) {
      throw new NotFoundError("Commodity Batch", data.commodityBatchId);
    }

    if (!["verified", "stored"].includes(batch.status)) {
      throw new ValidationError(
        `Batch must be 'verified' or 'stored' to create a listing. Current status: '${batch.status}'`
      );
    }

    const [newListing] = await db
      .insert(marketplaceListings)
      .values({
        ...data,
        listingStatus: "active",
      })
      .returning();

    // Update batch status to 'listed'
    await db
      .update(commodityBatches)
      .set({ status: "listed", updatedAt: new Date() })
      .where(eq(commodityBatches.id, data.commodityBatchId));

    return c.json(success(newListing), 201);
  }
);

// --- GET /listings/:id ---
listingRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [result] = await db
    .select({
      listing: marketplaceListings,
      cooperativeName: cooperatives.name,
      cooperativeVillage: cooperatives.villageName,
      cooperativeDistrict: cooperatives.district,
      commodityName: commodities.name,
      commodityCategory: commodities.category,
      commodityUnit: commodities.unit,
      qualityStatus: commodityBatches.qualityStatus,
      batchCode: commodityBatches.batchCode,
    })
    .from(marketplaceListings)
    .leftJoin(cooperatives, eq(marketplaceListings.cooperativeId, cooperatives.id))
    .leftJoin(commodityBatches, eq(marketplaceListings.commodityBatchId, commodityBatches.id))
    .leftJoin(commodities, eq(commodityBatches.commodityId, commodities.id))
    .where(eq(marketplaceListings.id, id))
    .limit(1);

  if (!result) {
    throw new NotFoundError("Listing", id);
  }

  return c.json(
    success({
      ...result.listing,
      cooperativeName: result.cooperativeName,
      cooperativeVillage: result.cooperativeVillage,
      cooperativeDistrict: result.cooperativeDistrict,
      commodityName: result.commodityName,
      commodityCategory: result.commodityCategory,
      commodityUnit: result.commodityUnit,
      qualityStatus: result.qualityStatus,
      batchCode: result.batchCode,
    })
  );
});

// --- PATCH /listings/:id ---
listingRoutes.patch(
  "/:id",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin"),
  async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();

    const updateSchema = z.object({
      title: z.string().min(3).optional(),
      description: z.string().optional(),
      pricePerUnit: z.string().or(z.number()).transform(String).optional(),
      availableQuantity: z.string().or(z.number()).transform(String).optional(),
      minimumOrder: z.string().or(z.number()).transform(String).optional(),
      listingStatus: z.enum(["draft", "active", "paused", "sold_out"]).optional(),
    });

    const data = updateSchema.parse(body);

    const [updated] = await db
      .update(marketplaceListings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError("Listing", id);
    }

    return c.json(success(updated));
  }
);
