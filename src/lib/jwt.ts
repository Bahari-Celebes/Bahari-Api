import { SignJWT, jwtVerify } from "jose";
import type { JwtPayload } from "./types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "bahari-dev-secret-change-in-production"
);

const JWT_EXPIRATION = "24h";

/**
 * Generate a JWT access token
 */
export async function generateToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT access token
 */
export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return {
    userId: payload.userId as string,
    role: payload.role as JwtPayload["role"],
    cooperativeId: payload.cooperativeId as string | undefined,
    producerId: payload.producerId as string | undefined,
  };
}
