import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "../src/modules/auth/auth.routes";
import { cooperativeRoutes } from "../src/modules/cooperatives/cooperatives.routes";
import { commodityRoutes } from "../src/modules/commodities/commodities.routes";
import { transactionRoutes } from "../src/modules/transactions/transactions.routes";
import { supplyChainRoutes } from "../src/modules/supply-chain/supply-chain.routes";
import { feasibilityRoutes } from "../src/modules/feasibility/feasibility.routes";
import { scenarioRoutes } from "../src/modules/scenarios/scenarios.routes";
import { impactRoutes } from "../src/modules/impact/impact.routes";
import { aiCopilotRoutes } from "../src/modules/ai-copilot/ai-copilot.routes";
import { syncRoutes } from "../src/modules/sync/sync.routes";
import { errorHandler } from "../src/middleware/error-handler";
import type { AppEnv } from "../src/lib/types";

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
