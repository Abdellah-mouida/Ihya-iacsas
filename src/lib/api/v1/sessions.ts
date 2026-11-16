import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { extractClientIpFromHeaders } from "@/lib/request-ip";
import { toApiSessionDTO, type ApiSessionDTO } from "./dto";
import { ApiError } from "./errors";
import {
  generateOpaqueRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_DAYS,
  signApiAccessToken,
  verifyGoogleIdToken,
} from "./tokens";

export interface DeviceContext {
  deviceName?: string | null;
  platform?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface TokenPairResult {
  tokenType: "Bearer";
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: string;
  session: ApiSessionDTO;
}

function sanitizeDeviceMeta(meta?: DeviceContext) {
  const deviceName = meta?.deviceName?.trim().slice(0, 100) || null;
  const platform = meta?.platform?.trim().slice(0, 32) || null;
  const ipAddress = meta?.ipAddress?.trim().slice(0, 64) || null;
  const userAgent = meta?.userAgent?.trim().slice(0, 256) || null;
  return { deviceName, platform, ipAddress, userAgent };
}

function computeRefreshExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createApiSessionWithTokens(params: {
  user: {
    id: string;
    role: Role;
    sessionVersion: number;
  };
  device?: DeviceContext;
}): Promise<TokenPairResult> {
  const familyId = randomUUID();
  const rawRefresh = generateOpaqueRefreshToken();
  const tokenHash = hashRefreshToken(rawRefresh);
  const expiresAt = computeRefreshExpiry();
  const meta = sanitizeDeviceMeta(params.device);

  const session = await prisma.apiSession.create({
    data: {
      userId: params.user.id,
      familyId,
      deviceName: meta.deviceName,
      platform: meta.platform,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      sessionVersion: params.user.sessionVersion,
      expiresAt,
      refreshTokens: {
        create: {
          familyId,
          tokenHash,
          expiresAt,
        },
      },
    },
  });

  const access = await signApiAccessToken({
    userId: params.user.id,
    sessionId: session.id,
    role: params.user.role,
    sessionVersion: params.user.sessionVersion,
  });

  return {
    tokenType: "Bearer",
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: rawRefresh,
    refreshExpiresAt: expiresAt.toISOString(),
    session: toApiSessionDTO(session, session.id),
  };
}

async function revokeTokenFamily(
  familyId: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.apiSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    }),
    prisma.apiRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

export async function refreshApiSessionTokens(
  rawRefreshToken: string,
  device?: DeviceContext,
): Promise<TokenPairResult> {
  const tokenHash = hashRefreshToken(rawRefreshToken.trim());
  const existing = await prisma.apiRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      session: {
        include: {
          user: {
            select: {
              id: true,
              role: true,
              emailVerified: true,
              sessionVersion: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid refresh token");
  }

  const now = new Date();
  const { session } = existing;
  const { user } = session;

  // Reuse detection: token was already rotated or explicitly revoked -> revoke entire family
  if (existing.usedAt !== null || existing.revokedAt !== null) {
    await revokeTokenFamily(existing.familyId, "REFRESH_REUSE_DETECTED");
    await logActivity({
      actorId: user.id,
      action: "ACCESS_DENIED",
      targetType: "ApiSession",
      targetId: session.id,
      details: { reason: "refresh_token_reuse_detected", familyId: existing.familyId },
    });
    throw new ApiError(
      401,
      "REFRESH_TOKEN_REUSED",
      "Refresh token reuse detected; session family revoked",
    );
  }

  if (
    existing.expiresAt <= now ||
    session.revokedAt !== null ||
    session.expiresAt <= now ||
    !user.emailVerified ||
    session.sessionVersion !== user.sessionVersion
  ) {
    await revokeTokenFamily(existing.familyId, "SESSION_EXPIRED_OR_REVOKED");
    throw new ApiError(401, "SESSION_REVOKED", "Session has expired or been revoked");
  }

  const nextRawRefresh = generateOpaqueRefreshToken();
  const nextTokenHash = hashRefreshToken(nextRawRefresh);
  const nextRefreshExpiresAt = computeRefreshExpiry();
  const meta = sanitizeDeviceMeta(device);

  const rotated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.apiRefreshToken.updateMany({
      where: {
        id: existing.id,
        usedAt: null,
        revokedAt: null,
      },
      data: { usedAt: now },
    });

    if (claimed.count !== 1) {
      return { conflict: true as const };
    }

    const nextRow = await tx.apiRefreshToken.create({
      data: {
        sessionId: session.id,
        familyId: existing.familyId,
        tokenHash: nextTokenHash,
        expiresAt: nextRefreshExpiresAt,
      },
    });

    await tx.apiRefreshToken.update({
      where: { id: existing.id },
      data: { replacedById: nextRow.id },
    });

    const updatedSession = await tx.apiSession.update({
      where: { id: session.id },
      data: {
        lastUsedAt: now,
        expiresAt: nextRefreshExpiresAt,
        ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      },
    });

    return { conflict: false as const, updatedSession };
  });

  if (rotated.conflict) {
    await revokeTokenFamily(existing.familyId, "REFRESH_CONCURRENT_REUSE");
    throw new ApiError(
      401,
      "REFRESH_TOKEN_REUSED",
      "Refresh token reuse detected; session family revoked",
    );
  }

  const access = await signApiAccessToken({
    userId: user.id,
    sessionId: session.id,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  return {
    tokenType: "Bearer",
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: nextRawRefresh,
    refreshExpiresAt: nextRefreshExpiresAt.toISOString(),
    session: toApiSessionDTO(rotated.updatedSession, rotated.updatedSession.id),
  };
}

export async function listApiSessionsForUser(
  userId: string,
  currentSessionId?: string | null,
): Promise<ApiSessionDTO[]> {
  const rows = await prisma.apiSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastUsedAt: "desc" },
  });
  return rows.map((row) => toApiSessionDTO(row, currentSessionId));
}

export async function revokeApiSessionForUser(
  userId: string,
  sessionId: string,
  reason = "USER_REVOKED",
): Promise<void> {
  const session = await prisma.apiSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, familyId: true },
  });
  if (!session || session.userId !== userId) {
    throw new ApiError(404, "NOT_FOUND", "Session not found");
  }
  await revokeTokenFamily(session.familyId, reason);
}

export function extractDeviceContext(
  request: Request,
  override?: { deviceName?: string | null; platform?: string | null },
): DeviceContext {
  return {
    deviceName:
      override?.deviceName ?? request.headers.get("x-device-name") ?? null,
    platform:
      override?.platform ?? request.headers.get("x-client-platform") ?? null,
    ipAddress: extractClientIpFromHeaders(request.headers),
    userAgent: request.headers.get("user-agent"),
  };
}

export async function revokeApiSessionByRefreshToken(
  rawRefreshToken: string,
  expectedUserId?: string,
): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken.trim());
  const row = await prisma.apiRefreshToken.findUnique({
    where: { tokenHash },
    include: { session: { select: { userId: true, familyId: true } } },
  });
  if (!row) return;
  if (expectedUserId && row.session.userId !== expectedUserId) {
    throw new ApiError(403, "FORBIDDEN", "Refresh token does not belong to user");
  }
  await revokeTokenFamily(row.session.familyId, "USER_LOGOUT");
}

export async function revokeAllApiSessionsForUser(
  userId: string,
  reason = "LOGOUT_ALL",
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    }),
    prisma.apiSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    }),
    prisma.apiRefreshToken.updateMany({
      where: { session: { userId }, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

export async function loginWithPasswordForApi(params: {
  email: string;
  password: string;
  device?: DeviceContext;
}): Promise<{ tokens: TokenPairResult; userId: string }> {
  const email = params.email.trim().toLowerCase();
  const ip = (params.device?.ipAddress || "127.0.0.1").slice(0, 64);

  const [emailRate, ipRate] = await Promise.all([
    checkRateLimit(`auth_login:${email}`, 5, 15 * 60),
    checkRateLimit(`api_login_ip:${ip}`, 25, 15 * 60),
  ]);
  if (!emailRate.allowed || !ipRate.allowed) {
    const retryAfter = Math.max(emailRate.retryAfter ?? 0, ipRate.retryAfter ?? 0, 60);
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Too many login attempts. Please try again later.",
      { headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    await bcrypt.compare(
      params.password,
      "$2a$12$e80yq5kZ9xVlF53rN7zG7.qK0N3sZ0sK1y5J5k5.3N3sZ0sK1y5J5",
    );
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (!user.emailVerified) {
    throw new ApiError(403, "EMAIL_NOT_VERIFIED", "Email address is not verified");
  }

  let authenticated = false;
  let usedTempPassword = false;

  if (user.passwordHash) {
    authenticated = await bcrypt.compare(params.password, user.passwordHash);
  }

  if (
    !authenticated &&
    user.tempPasswordHash &&
    user.tempPasswordExpiresAt &&
    user.tempPasswordExpiresAt > new Date()
  ) {
    authenticated = await bcrypt.compare(params.password, user.tempPasswordHash);
    usedTempPassword = authenticated;
  }

  if (!authenticated) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await clearRateLimit(`auth_login:${email}`);

  const now = new Date();
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: now,
      lastActiveAt: now,
      ...(usedTempPassword ? { mustChangePassword: true } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sessionVersion: true,
    },
  });

  await logActivity({
    actorId: updatedUser.id,
    actorName: updatedUser.name,
    actorEmail: updatedUser.email,
    actorRole: updatedUser.role,
    action: "SIGN_IN_CREDENTIALS",
    targetType: "User",
    targetId: updatedUser.id,
    targetName: updatedUser.name,
    targetEmail: updatedUser.email,
    details: { channel: "api_v1" },
  });

  const tokens = await createApiSessionWithTokens({
    user: updatedUser,
    device: params.device,
  });

  return { tokens, userId: updatedUser.id };
}

export async function loginWithGoogleForApi(params: {
  idToken: string;
  device?: DeviceContext;
}): Promise<{ tokens: TokenPairResult; userId: string }> {
  const ip = (params.device?.ipAddress || "127.0.0.1").slice(0, 64);
  const ipRate = await checkRateLimit(`api_google_ip:${ip}`, 20, 15 * 60);
  if (!ipRate.allowed) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again later.", {
      headers: { "Retry-After": String(ipRate.retryAfter ?? 60) },
    });
  }

  const identity = await verifyGoogleIdToken(params.idToken);

  let user = await prisma.user.findUnique({
    where: { email: identity.email },
  });

  const now = new Date();
  if (user) {
    const updates: Record<string, unknown> = {
      lastLoginAt: now,
      lastActiveAt: now,
    };
    if (!user.emailVerified && user.passwordHash) {
      updates.passwordHash = null;
      updates.emailVerified = now;
    } else if (!user.emailVerified) {
      updates.emailVerified = now;
    }
    if (!user.image && identity.picture) {
      updates.image = identity.picture;
    }
    if (!user.name && identity.name) {
      updates.name = identity.name;
    }

    user = await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: identity.email,
        name: identity.name,
        image: identity.picture,
        emailVerified: now,
        role: Role.USER,
        lastLoginAt: now,
        lastActiveAt: now,
      },
    });
  }

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: identity.sub,
      },
    },
    update: { userId: user.id },
    create: {
      userId: user.id,
      type: "oidc",
      provider: "google",
      providerAccountId: identity.sub,
    },
  });

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    actorRole: user.role,
    action: "SIGN_IN_GOOGLE",
    targetType: "User",
    targetId: user.id,
    targetName: user.name,
    targetEmail: user.email,
    details: { channel: "api_v1_google_id_token" },
  });

  const tokens = await createApiSessionWithTokens({
    user: {
      id: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
    device: params.device,
  });

  return { tokens, userId: user.id };
}
