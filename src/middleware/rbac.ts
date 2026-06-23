import type { Context, Next } from "hono";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import type { AppEnv, UserRole } from "../lib/types";

/**
 * Role-based access control middleware
 * Checks if authenticated user has one of the allowed roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${allowedRoles.join(" or ")}`
      );
    }

    await next();
  };
}

/**
 * Cooperative access middleware
 * Ensures the user can only access resources belonging to their cooperative
 * Super admin bypasses this check
 */
export function requireCooperativeAccess(cooperativeIdParam = "cooperativeId") {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    // Super admin can access all cooperatives
    if (user.role === "super_admin") {
      await next();
      return;
    }

    // Get cooperative ID from query, body, or param
    const cooperativeId =
      c.req.query("cooperative_id") ||
      c.req.param(cooperativeIdParam);

    if (cooperativeId && user.cooperativeId !== cooperativeId) {
      throw new ForbiddenError("You can only access your own cooperative's data");
    }

    await next();
  };
}
