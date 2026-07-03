import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { cooperativeRoutes } from "./modules/cooperatives/cooperatives.routes.js";
import { commodityRoutes } from "./modules/commodities/commodities.routes.js";
import { transactionRoutes } from "./modules/transactions/transactions.routes.js";
import { supplyChainRoutes } from "./modules/supply-chain/supply-chain.routes.js";
import { feasibilityRoutes } from "./modules/feasibility/feasibility.routes.js";
import { scenarioRoutes } from "./modules/scenarios/scenarios.routes.js";
import { impactRoutes } from "./modules/impact/impact.routes.js";
import { aiCopilotRoutes } from "./modules/ai-copilot/ai-copilot.routes.js";
import { syncRoutes } from "./modules/sync/sync.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import type { AppEnv } from "./lib/types.js";

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

app.onError(errorHandler);

// --- Health Check ---
app.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "0.2.0",
    },
  });
});

// --- Routes ---
app.route("/auth", authRoutes);
app.route("/cooperatives", cooperativeRoutes);
app.route("/commodities", commodityRoutes);
app.route("/transactions", transactionRoutes);
app.route("/supply-chain", supplyChainRoutes);
app.route("/feasibility", feasibilityRoutes);
app.route("/scenarios", scenarioRoutes);
app.route("/impact", impactRoutes);
app.route("/ai", aiCopilotRoutes);
app.route("/sync", syncRoutes);

app.notFound((c) => {
  return c.json(
    { success: false, error: { message: "Route not found", code: "NOT_FOUND" } },
    404
  );
});

const port = parseInt(process.env.PORT || "3000", 10);
console.log(`🌊 BAHARI Intelligence API running on http://localhost:${port}`);

export default { port, fetch: app.fetch };
