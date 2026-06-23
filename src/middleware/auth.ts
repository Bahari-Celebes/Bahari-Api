import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt";
import { UnauthorizedError } from "../lib/errors";
import type { AppEnv } from "../lib/types";

/**
 * Authentication middleware
 * Verifies JWT from Authorization header and sets user in context
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/**
 * Helper to get authenticated user from context
 */
export function getCurrentUser(c: Context<AppEnv>) {
  return c.get("user");
}
