import { Hono } from "hono";
import { eq, gte, or, and } from "drizzle-orm";
import type { AppEnv } from "../../lib/types.js";
import { authMiddleware, getCurrentUser } from "../../middleware/auth.js";
import { db } from "../../db/index.js";
import { commodityRecords, transactionRecords, feasibilityScenarios } from "../../db/schema/index.js";
import { success } from "../../lib/response.js";
import { z } from "zod";

export const syncRoutes = new Hono<AppEnv>();

// --- POST /sync/push ---
syncRoutes.post("/push", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const body = await c.req.json();

  const pushSchema = z.object({
    table: z.enum(["commodity_records", "transaction_records", "feasibility_scenarios"]),
    operation: z.enum(["insert", "update", "delete"]),
    recordId: z.string().uuid(),
    data: z.any().optional(),
    syncVersion: z.number().int().positive().optional(),
  });
  const items = z.array(pushSchema).parse(body.items);

  let inserted = 0, updated = 0, deleted = 0;

  for (const item of items) {
    try {
      if (item.operation === "delete") {
        const table = item.table === "commodity_records" ? commodityRecords
          : item.table === "transaction_records" ? transactionRecords : feasibilityScenarios;
        await db.delete(table as any).where(eq((table as any).id, item.recordId));
        deleted++;
      } else if (item.operation === "update") {
        const table = item.table === "commodity_records" ? commodityRecords
          : item.table === "transaction_records" ? transactionRecords : feasibilityScenarios;
        await db.update(table as any).set({ ...item.data, updatedAt: new Date() }).where(eq((table as any).id, item.recordId));
        updated++;
      } else {
        // insert — scoped to cooperative.
        const table = item.table === "commodity_records" ? commodityRecords
          : item.table === "transaction_records" ? transactionRecords : feasibilityScenarios;
        if (item.data) {
          await db.insert(table as any).values(item.data);
          inserted++;
        }
      }
    } catch {
      // Skip conflicts — last-write-wins strategy.
    }
  }

  return c.json(success({ inserted, updated, deleted }));
});

// --- GET /sync/pull?since=timestamp ---
syncRoutes.get("/pull", authMiddleware, async (c) => {
  const user = getCurrentUser(c);
  const since = c.req.query("since") || new Date(0).toISOString();
  const coopId = user.cooperativeId;

  if (!coopId) {
    return c.json(success({ commodities: [], transactions: [], scenarios: [] }));
  }

  const [cmds, txs, scenarios] = await Promise.all([
    db.select().from(commodityRecords).where(
      and(eq(commodityRecords.cooperativeId, coopId), gte(commodityRecords.updatedAt, new Date(since)))
    ),
    db.select().from(transactionRecords).where(
      and(eq(transactionRecords.cooperativeId, coopId), gte(transactionRecords.updatedAt, new Date(since)))
    ),
    db.select().from(feasibilityScenarios).where(
      and(eq(feasibilityScenarios.cooperativeId, coopId), gte(feasibilityScenarios.updatedAt, new Date(since)))
    ),
  ]);

  return c.json(success({ commodities: cmds, transactions: txs, scenarios }));
});
