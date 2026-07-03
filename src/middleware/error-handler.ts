import type { Context } from "hono";
import { AppError } from "../lib/errors.js";

/**
 * Global error handler for the API
 */
export function errorHandler(err: Error, c: Context) {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          message: err.message,
          code: err.code,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.statusCode as any
    );
  }

  // Zod validation errors
  if (err.name === "ZodError") {
    return c.json(
      {
        success: false,
        error: {
          message: "Validation failed",
          code: "VALIDATION_ERROR",
          details: (err as any).issues,
        },
      },
      400
    );
  }

  // Unexpected errors
  return c.json(
    {
      success: false,
      error: {
        message:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
        code: "INTERNAL_ERROR",
      },
    },
    500
  );
}
