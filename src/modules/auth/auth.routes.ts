import { Hono } from "hono";
import type { AppEnv } from "../../lib/types";
import { authMiddleware, getCurrentUser } from "../../middleware/auth";
import { loginSchema, registerSchema } from "./auth.schema";
import * as authService from "./auth.service";
import { success } from "../../lib/response";

export const authRoutes = new Hono<AppEnv>();

// --- POST /auth/register ---
authRoutes.post("/register", async (c) => {
  const body = await c.req.json();
  const data = registerSchema.parse(body);
  const result = await authService.register(data);
  return c.json(success(result), 201);
});

// --- POST /auth/login ---
authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const data = loginSchema.parse(body);
  const result = await authService.login(data);
  return c.json(success(result));
});

// --- GET /me ---
authRoutes.get("/me", authMiddleware, async (c) => {
  const { userId } = getCurrentUser(c);
  const user = await authService.getMe(userId);
  return c.json(success(user));
});
