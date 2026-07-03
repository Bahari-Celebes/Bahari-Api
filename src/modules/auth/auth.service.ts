import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { generateToken, TOKEN_TTL_SECONDS } from "../../lib/jwt.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../lib/errors.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const publicUser = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  cooperativeId: users.cooperativeId,
  createdAt: users.createdAt,
} as const;

/**
 * Register a new user
 */
export async function register(input: RegisterInput) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const [newUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      cooperativeId: input.cooperativeId || null,
    })
    .returning(publicUser);

  const accessToken = await generateToken({
    userId: newUser.id,
    role: newUser.role,
    cooperativeId: newUser.cooperativeId ?? undefined,
  });

  return {
    accessToken,
    tokenExpiry: TOKEN_TTL_SECONDS,
    user: newUser,
  };
}

/**
 * Login with email and password
 */
export async function login(input: LoginInput) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const accessToken = await generateToken({
    userId: user.id,
    role: user.role,
    cooperativeId: user.cooperativeId ?? undefined,
  });

  return {
    accessToken,
    tokenExpiry: TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cooperativeId: user.cooperativeId,
    },
  };
}

/**
 * Get current authenticated user
 */
export async function getMe(userId: string) {
  const [user] = await db
    .select(publicUser)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User", userId);
  }

  return user;
}
