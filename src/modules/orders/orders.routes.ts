import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { db } from "../../db";
import { orders, orderItems, marketplaceListings, users } from "../../db/schema";
import { success, paginated, parsePagination, getOffset } from "../../lib/response";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { z } from "zod";

export const orderRoutes = new Hono<AppEnv>();

const createOrderSchema = z.object({
  cooperativeId: z.string().uuid(),
  items: z.array(
    z.object({
      listingId: z.string().uuid(),
      quantity: z.number().positive(),
    })
  ).min(1),
  deliveryMethod: z.string().optional(),
  buyerNotes: z.string().optional(),
});

/**
 * Generate a unique order code
 */
function generateOrderCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${date}-${random}`;
}

// --- GET /orders ---
orderRoutes.get("/", authMiddleware, async (c) => {
  const { page, limit } = parsePagination(c.req.query());
  const user = getCurrentUser(c);
  const status = c.req.query("status");

  const conditions = [];

  // Scope by role
  if (user.role === "buyer") {
    conditions.push(eq(orders.buyerId, user.userId));
  } else if (user.role === "cooperative_admin" && user.cooperativeId) {
    conditions.push(eq(orders.cooperativeId, user.cooperativeId));
  }
  // super_admin sees all

  if (status) {
    conditions.push(eq(orders.status, status as any));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db
      .select({
        order: orders,
        buyerName: users.name,
        buyerEmail: users.email,
      })
      .from(orders)
      .leftJoin(users, eq(orders.buyerId, users.id))
      .where(where)
      .limit(limit)
      .offset(getOffset({ page, limit }))
      .orderBy(orders.createdAt),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(where),
  ]);

  const result = data.map((row) => ({
    ...row.order,
    buyerName: row.buyerName,
    buyerEmail: row.buyerEmail,
  }));

  return c.json(paginated(result, { page, limit, total: Number(countResult[0].count) }));
});

// --- POST /orders ---
orderRoutes.post(
  "/",
  authMiddleware,
  requireRole("buyer"),
  async (c) => {
    const body = await c.req.json();
    const data = createOrderSchema.parse(body);
    const user = getCurrentUser(c);

    // Fetch listings and calculate totals
    let totalAmount = 0;
    const itemDetails = [];

    for (const item of data.items) {
      const [listing] = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.id, item.listingId))
        .limit(1);

      if (!listing) {
        throw new NotFoundError("Listing", item.listingId);
      }

      if (listing.listingStatus !== "active") {
        throw new ValidationError(`Listing '${listing.title}' is not available`);
      }

      const available = parseFloat(listing.availableQuantity);
      if (item.quantity > available) {
        throw new ValidationError(
          `Requested quantity (${item.quantity}) exceeds available stock (${available}) for '${listing.title}'`
        );
      }

      const unitPrice = parseFloat(listing.pricePerUnit);
      const subtotal = unitPrice * item.quantity;
      totalAmount += subtotal;

      itemDetails.push({
        listingId: item.listingId,
        commodityName: listing.title,
        quantity: String(item.quantity),
        unitPrice: String(unitPrice),
        subtotal: String(subtotal),
      });
    }

    // Create order
    const orderCode = generateOrderCode();
    const [newOrder] = await db
      .insert(orders)
      .values({
        buyerId: user.userId,
        cooperativeId: data.cooperativeId,
        orderCode,
        totalAmount: String(totalAmount),
        status: "pending",
        deliveryMethod: data.deliveryMethod,
        buyerNotes: data.buyerNotes,
      })
      .returning();

    // Create order items
    for (const item of itemDetails) {
      await db.insert(orderItems).values({
        orderId: newOrder.id,
        ...item,
      });
    }

    // Reduce available quantity in listings
    for (const item of data.items) {
      await db
        .update(marketplaceListings)
        .set({
          availableQuantity: sql`${marketplaceListings.availableQuantity}::numeric - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(marketplaceListings.id, item.listingId));
    }

    return c.json(success(newOrder), 201);
  }
);

// --- GET /orders/:id ---
orderRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id");

  const [order] = await db
    .select({
      order: orders,
      buyerName: users.name,
      buyerEmail: users.email,
    })
    .from(orders)
    .leftJoin(users, eq(orders.buyerId, users.id))
    .where(eq(orders.id, id))
    .limit(1);

  if (!order) {
    throw new NotFoundError("Order", id);
  }

  // Fetch order items
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  return c.json(
    success({
      ...order.order,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      items,
    })
  );
});

// --- PATCH /orders/:id/status ---
const validTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed"],
  packed: ["ready_for_pickup"],
  ready_for_pickup: ["delivered"],
  delivered: ["completed"],
};

orderRoutes.patch(
  "/:id/status",
  authMiddleware,
  requireRole("super_admin", "cooperative_admin", "buyer"),
  async (c) => {
    const id = c.req.param("id");
    const { status: newStatus } = z
      .object({
        status: z.enum([
          "pending", "confirmed", "packed", "ready_for_pickup",
          "delivered", "completed", "cancelled",
        ]),
      })
      .parse(await c.req.json());

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      throw new NotFoundError("Order", id);
    }

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from '${order.status}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}`
      );
    }

    const [updated] = await db
      .update(orders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();

    // If cancelled, restore stock
    if (newStatus === "cancelled") {
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, id));

      for (const item of items) {
        await db
          .update(marketplaceListings)
          .set({
            availableQuantity: sql`${marketplaceListings.availableQuantity}::numeric + ${item.quantity}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(marketplaceListings.id, item.listingId));
      }
    }

    return c.json(success(updated));
  }
);
