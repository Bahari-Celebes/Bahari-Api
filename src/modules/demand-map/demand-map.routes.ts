import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { db } from "../../db/index.js";
import { outletLocations, cooperatives } from "../../db/schema/index.js";
import { success } from "../../lib/response.js";
import { z } from "zod";

export const demandMapRoutes = new Hono<AppEnv>();

const outletSchema = z.object({
  cooperativeId: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(["warung", "toko", "cabang"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  commoditiesSold: z.array(z.string()).optional(),
  capacity: z.number().int().min(1).default(100),
});

// --- GET /demand-map/outlets?cooperativeId=xxx ---
demandMapRoutes.get("/outlets", authMiddleware, async (c) => {
  const coopId = c.req.query("cooperativeId")!;
  const outlets = await db.select().from(outletLocations).where(eq(outletLocations.cooperativeId, coopId));

  const [coop] = await db.select().from(cooperatives).where(eq(cooperatives.id, coopId)).limit(1);

  return c.json(success({
    cooperativeId: coopId,
    cooperativeName: coop?.name ?? "",
    total: outlets.length,
    outlets: outlets.map(o => ({ ...o, latitude: Number(o.latitude), longitude: Number(o.longitude) })),
  }));
});

// --- POST /demand-map/outlets ---
demandMapRoutes.post("/outlets", authMiddleware, requireRole("cooperative_manager"), async (c) => {
  const body = await c.req.json();
  const data = outletSchema.parse(body);
  const [outlet] = await db.insert(outletLocations).values({ ...data, latitude: String(data.latitude), longitude: String(data.longitude) }).returning();
  return c.json(success(outlet), 201);
});

// --- GET /demand-map/coverage?cooperativeId=xxx ---
demandMapRoutes.get("/coverage", authMiddleware, async (c) => {
  const coopId = c.req.query("cooperativeId")!;
  const outlets = await db.select().from(outletLocations).where(eq(outletLocations.cooperativeId, coopId));

  // Simple coverage analysis: count outlets by type
  const byType: Record<string, number> = {};
  for (const o of outlets) { byType[o.type] = (byType[o.type] || 0) + 1; }
  const totalCapacity = outlets.reduce((s, o) => s + (o.capacity ?? 0), 0);

  // ponytail: approximate coverage range. Add GIS-based radius analysis when Leaflet is integrated.
  return c.json(success({ cooperativeId: coopId, totalOutlets: outlets.length, byType, totalCapacity, uncoveredAreas: 0 }));
});
