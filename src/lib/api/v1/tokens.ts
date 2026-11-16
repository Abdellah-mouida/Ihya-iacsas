import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import type { Role } from "@prisma/client";
import { ApiError } from "./errors";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;
const JWT_ISSUER = "ihyaa-api";
const JWT_AUDIENCE = "ihyaa-external";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let cachedGoogleJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getGoogleJwks() {
  if (!cachedGoogleJwks) {
    cachedGoogleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return cachedGoogleJwks;
}

export function assertApiTokenSecretConfigured(): Uint8Array {
  const raw = process.env.API_TOKEN_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "API_TOKEN_SECRET environment variable is required and must be at least 32 characters",
    );
  }
  return new TextEncoder().encode(raw);
}

export interface ApiAccessTokenPayload {
  userId: string;
  sessionId: string;
  role: Role;
  sessionVersion: number;
  jti: string;
  exp: number;
}

export async function signApiAccessToken(params: {
  userId: string;
  sessionId: string;
  role: Role;
  sessionVersion: number;
}): Promise<{ token: string; expiresIn: number }> {
  const secret = assertApiTokenSecretConfigured();
  const token = await new SignJWT({
    sid: params.sessionId,
    role: params.role,
    ver: params.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(params.userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);

  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function verifyApiAccessToken(
  token: string,
): Promise<ApiAccessTokenPayload> {
  const secret = assertApiTokenSecretConfigured();
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    payload = result.payload;
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "Access token is invalid or expired");
  }

  const userId = typeof payload.sub === "string" ? payload.sub : "";
  const sessionId = typeof payload.sid === "string" ? payload.sid : "";
  const role = payload.role as Role | undefined;
  const sessionVersion =
    typeof payload.ver === "number" && Number.isInteger(payload.ver)
      ? payload.ver
      : -1;
  const jti = typeof payload.jti === "string" ? payload.jti : "";
  const exp = typeof payload.exp === "number" ? payload.exp : 0;

  if (
    !userId ||
    !sessionId ||
    !jti ||
    sessionVersion < 1 ||
    (role !== "USER" && role !== "MODERATOR" && role !== "ADMIN")
  ) {
    throw new ApiError(401, "INVALID_TOKEN", "Malformed access token");
  }

  return { userId, sessionId, role, sessionVersion, jti, exp };
}

export function generateOpaqueRefreshToken(): string {
  return `ihyaa_rt_${randomBytes(32).toString("base64url")}`;
}

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function getAllowedGoogleClientIds(): string[] {
  const ids = new Set<string>();
  const singleKeys = [
    process.env.AUTH_GOOGLE_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ];
  for (const val of singleKeys) {
    const clean = val?.trim();
    if (clean) ids.add(clean);
  }
  const multi = process.env.AUTH_GOOGLE_MOBILE_IDS ?? "";
  for (const item of multi.split(",")) {
    const clean = item.trim();
    if (clean) ids.add(clean);
  }
  return Array.from(ids);
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  options?: {
    jwks?: ReturnType<typeof createRemoteJWKSet>;
    allowedAudiences?: string[];
  },
): Promise<VerifiedGoogleIdentity> {
  const allowedAudiences = options?.allowedAudiences ?? getAllowedGoogleClientIds();
  if (allowedAudiences.length === 0) {
    throw new ApiError(
      503,
      "GOOGLE_AUTH_UNAVAILABLE",
      "Google sign-in is not configured",
    );
  }

  const jwks = options?.jwks ?? getGoogleJwks();
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(idToken, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: allowedAudiences,
    });
    payload = verified.payload;
  } catch {
    throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Invalid Google ID token");
  }

  const sub = typeof payload.sub === "string" ? payload.sub.trim() : "";
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === "string" ? payload.name.trim() || null : null;
  const picture =
    typeof payload.picture === "string" ? payload.picture.trim() || null : null;

  if (!sub || !email || !emailVerified) {
    throw new ApiError(
      401,
      "UNVERIFIED_GOOGLE_ACCOUNT",
      "Google account email must be verified",
    );
  }

  return { sub, email, name, picture };
}
