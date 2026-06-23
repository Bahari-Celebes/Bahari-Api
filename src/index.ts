import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { authRoutes } from "./modules/auth/auth.routes";
import { cooperativeRoutes } from "./modules/cooperatives/cooperatives.routes";
import { producerRoutes } from "./modules/producers/producers.routes";
import { commodityRoutes } from "./modules/commodities/commodities.routes";
import { batchRoutes } from "./modules/batches/batches.routes";
import { listingRoutes } from "./modules/listings/listings.routes";
import { orderRoutes } from "./modules/orders/orders.routes";
import { ecopointRoutes } from "./modules/ecopoints/ecopoints.routes";
import { analyticsRoutes } from "./modules/analytics/analytics.routes";
import { errorHandler } from "./middleware/error-handler";
import type { AppEnv } from "./lib/types";

const app = new Hono<AppEnv>();

// --- Global Middleware ---
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:4321",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// --- Error Handler ---
app.onError(errorHandler);

// --- Health Check ---
app.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
    },
  });
});

// --- Routes ---
app.route("/auth", authRoutes);
app.route("/cooperatives", cooperativeRoutes);
app.route("/producers", producerRoutes);
app.route("/commodities", commodityRoutes);
app.route("/batches", batchRoutes);
app.route("/listings", listingRoutes);
app.route("/orders", orderRoutes);
app.route("/ecopoints", ecopointRoutes);
app.route("/analytics", analyticsRoutes);

// --- 404 Handler ---
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: { message: "Route not found", code: "NOT_FOUND" },
    },
    404
  );
});

// --- Start Server ---
const port = parseInt(process.env.PORT || "3000", 10);

console.log(`🌊 BAHARI API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
