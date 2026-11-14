import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { logActivity } from "@/lib/audit";
import { can, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { touchUserActive } from "@/lib/activity";
import { ChatServiceError } from "./friends";

export async function isChatEnabled(): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" },
    select: { value: true },
  });
  return row?.value === "true";
}

export async function assertChatEnabledOr404(): Promise<void> {
  if (!(await isChatEnabled())) {
    notFound();
  }
}

export async function requireChatEnabledApi(): Promise<NextResponse | null> {
  if (!(await isChatEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}

export interface ChatActor {
  id: string;
  name: string | null;
  image: string | null;
  role: "ADMIN" | "MODERATOR" | "USER";
  onboardingCompletedAt: Date | null;
  chatTermsAcceptedAt: Date | null;
  chatPublicTimeoutUntil: Date | null;
  chatBannedAt: Date | null;
  friendRequestPolicy: "EVERYONE" | "NOBODY";
  showOnlineStatus: boolean;
  showFriendCount: boolean;
}

export type ChatAuthResult =
  | { ok: true; user: ChatActor }
  | { ok: false; response: NextResponse };

export async function requireChatActor(options?: {
  requireTerms?: boolean;
}): Promise<ChatAuthResult> {
  const [enabled, session] = await Promise.all([isChatEnabled(), auth()]);
  if (!enabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      image: true,
      role: true,
      onboardingCompletedAt: true,
      chatTermsAcceptedAt: true,
      chatPublicTimeoutUntil: true,
      chatBannedAt: true,
      friendRequestPolicy: true,
      showOnlineStatus: true,
      showFriendCount: true,
    },
  });

  if (!user || !user.onboardingCompletedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Onboarding required" },
        { status: 403 },
      ),
    };
  }

  if (user.chatBannedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Chat access restricted" },
        { status: 403 },
      ),
    };
  }

  if (options?.requireTerms && !user.chatTermsAcceptedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Community guidelines acceptance required" },
        { status: 403 },
      ),
    };
  }

  touchUserActive(user.id).catch(() => {});

  return { ok: true, user };
}

export function chatErrorResponse(err: unknown, fallbackMessage: string) {
  if (err instanceof ChatServiceError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

export interface AdminApiActor {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "MODERATOR";
}

export async function requireAdminApiPermission(
  permission: Permission,
): Promise<
  | { ok: true; actor: AdminApiActor }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user || !can(user.role, permission)) {
    await logActivity({
      actorId: session.user.id,
      actorName: session.user.name ?? null,
      actorEmail: session.user.email ?? null,
      actorRole: session.user.role,
      action: "ACCESS_DENIED",
      targetType: "ADMIN_MODERATION",
      details: { permission },
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return {
    ok: true,
    actor: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export { canonicalPairKey } from "./friends";
