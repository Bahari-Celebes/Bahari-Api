import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateToken } from "../../lib/jwt";
import { ConflictError, NotFoundError, UnauthorizedError } from "../../lib/errors";
import type { RegisterInput, LoginInput } from "./auth.schema";

/**
 * Register a new user
 */
export async function register(input: RegisterInput) {
  // Check if email exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Email is already registered");
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      cooperativeId: input.cooperativeId || null,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      cooperativeId: users.cooperativeId,
      producerId: users.producerId,
      createdAt: users.createdAt,
    });

  // Generate token
  const accessToken = await generateToken({
    userId: newUser.id,
    role: newUser.role,
    cooperativeId: newUser.cooperativeId ?? undefined,
    producerId: newUser.producerId ?? undefined,
  });

  return {
    accessToken,
    user: newUser,
  };
}

/**
 * Login with email and password
 */
export async function login(input: LoginInput) {
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Verify password
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  // Generate token
  const accessToken = await generateToken({
    userId: user.id,
    role: user.role,
    cooperativeId: user.cooperativeId ?? undefined,
    producerId: user.producerId ?? undefined,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cooperativeId: user.cooperativeId,
      producerId: user.producerId,
    },
  };
}

/**
 * Get current authenticated user
 */
export async function getMe(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      cooperativeId: users.cooperativeId,
      producerId: users.producerId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError("User", userId);
  }

  return user;
}
