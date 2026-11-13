import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { touchUserActive } from "@/lib/activity";

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
  const disabled = await requireChatEnabledApi();
  if (disabled) return { ok: false, response: disabled };

  const session = await auth();
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

export { canonicalPairKey } from "./friends";
