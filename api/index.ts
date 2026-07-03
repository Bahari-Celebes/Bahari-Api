import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "../src/modules/auth/auth.routes.js";
import { cooperativeRoutes } from "../src/modules/cooperatives/cooperatives.routes.js";
import { commodityRoutes } from "../src/modules/commodities/commodities.routes.js";
import { transactionRoutes } from "../src/modules/transactions/transactions.routes.js";
import { supplyChainRoutes } from "../src/modules/supply-chain/supply-chain.routes.js";
import { feasibilityRoutes } from "../src/modules/feasibility/feasibility.routes.js";
import { scenarioRoutes } from "../src/modules/scenarios/scenarios.routes.js";
import { impactRoutes } from "../src/modules/impact/impact.routes.js";
import { aiCopilotRoutes } from "../src/modules/ai-copilot/ai-copilot.routes.js";
import { syncRoutes } from "../src/modules/sync/sync.routes.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { AppEnv } from "../src/lib/types.js";

const app = new Hono<AppEnv>();

app.use("*", cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:4321",
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.onError(errorHandler);
app.get("/health", (c) => c.json({ success: true, data: { status: "ok", version: "0.3.0" } }));
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

export default app;
