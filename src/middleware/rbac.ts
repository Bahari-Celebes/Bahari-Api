import type { Context, Next } from "hono";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import type { AppEnv, JwtPayload, UserRole } from "../lib/types";

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
 * Cooperative access middleware.
 * Ensures the user can only access resources belonging to their cooperative.
 * Checks query/param; for body-scoped routes call assertCooperativeScope in the handler
 * (reading the body here would consume it before the handler can parse it).
 */
export function requireCooperativeAccess(cooperativeIdParam = "cooperativeId") {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    if (user.role === "admin") {
      await next();
      return;
    }

    const cooperativeId =
      c.req.query("cooperative_id") || c.req.param(cooperativeIdParam);

    if (cooperativeId && user.cooperativeId !== cooperativeId) {
      throw new ForbiddenError("You can only access your own cooperative's data");
    }

    await next();
  };
}

/**
 * Assert that a non-admin user is acting on their own cooperative.
 * Use in handlers after parsing a body that carries cooperativeId.
 */
export function assertCooperativeScope(
  user: JwtPayload,
  cooperativeId: string | undefined
) {
  if (user.role === "admin") return;
  if (!user.cooperativeId) {
    throw new ForbiddenError("Your account is not linked to a cooperative");
  }
  if (cooperativeId && cooperativeId !== user.cooperativeId) {
    throw new ForbiddenError("You can only access your own cooperative's data");
  }
}
