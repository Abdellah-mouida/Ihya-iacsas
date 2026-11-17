import type { Role } from "@prisma/client";
import { touchUserActive } from "@/lib/activity";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isChatEnabled } from "@/lib/chat/guards";
import { ApiError } from "./errors";
import { verifyApiAccessToken } from "./tokens";

export interface ApiActor {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  sessionId: string;
  sessionVersion: number;
  showOnlineStatus: boolean;
  onboardingCompletedAt: Date | null;
  chatTermsAcceptedAt: Date | null;
  chatPublicTimeoutUntil: Date | null;
  chatBannedAt: Date | null;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export async function getOptionalApiActor(
  request: Request,
): Promise<ApiActor | null> {
  const token = extractBearerToken(request);
  if (!token) return null;
  return requireApiActor(request);
}

export async function requireApiActor(
  request: Request,
  options?: {
    permission?: Permission;
    requireOnboarding?: boolean;
    requireChatEnabled?: boolean;
    requireChatTerms?: boolean;
  },
): Promise<ApiActor> {
  const token = extractBearerToken(request);
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing bearer access token");
  }

  const verified = await verifyApiAccessToken(token);

  const [user, session] = await Promise.all([
    prisma.user.findUnique({
      where: { id: verified.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        sessionVersion: true,
        showOnlineStatus: true,
        onboardingCompletedAt: true,
        chatTermsAcceptedAt: true,
        chatPublicTimeoutUntil: true,
        chatBannedAt: true,
      },
    }),
    prisma.apiSession.findUnique({
      where: { id: verified.sessionId },
      select: {
        id: true,
        userId: true,
        sessionVersion: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
  ]);

  if (!user || !user.emailVerified) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  if (
    !session ||
    session.userId !== user.id ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date() ||
    user.sessionVersion !== verified.sessionVersion ||
    session.sessionVersion !== user.sessionVersion
  ) {
    throw new ApiError(401, "SESSION_REVOKED", "Session is invalid or revoked");
  }

  if (options?.permission && !can(user.role, options.permission)) {
    throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
  }

  if (options?.requireOnboarding && !user.onboardingCompletedAt) {
    throw new ApiError(
      403,
      "ONBOARDING_REQUIRED",
      "Onboarding must be completed first",
    );
  }

  if (options?.requireChatEnabled) {
    if (!(await isChatEnabled())) {
      throw new ApiError(404, "NOT_FOUND", "Chat feature is not enabled");
    }
    if (!user.onboardingCompletedAt) {
      throw new ApiError(
        403,
        "ONBOARDING_REQUIRED",
        "Onboarding must be completed first",
      );
    }
    if (user.chatBannedAt) {
      throw new ApiError(403, "CHAT_BANNED", "Chat access restricted");
    }
    if (options.requireChatTerms && !user.chatTermsAcceptedAt) {
      throw new ApiError(
        403,
        "CHAT_TERMS_REQUIRED",
        "Community guidelines acceptance required",
      );
    }
  }

  touchUserActive(user.id).catch(() => {});

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionId: session.id,
    sessionVersion: user.sessionVersion,
    showOnlineStatus: user.showOnlineStatus,
    onboardingCompletedAt: user.onboardingCompletedAt,
    chatTermsAcceptedAt: user.chatTermsAcceptedAt,
    chatPublicTimeoutUntil: user.chatPublicTimeoutUntil,
    chatBannedAt: user.chatBannedAt,
  };
}
