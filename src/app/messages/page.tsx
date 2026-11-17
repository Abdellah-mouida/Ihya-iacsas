import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import type { ChatTab } from "@/components/chat/chat-types";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { assertChatEnabledOr404 } from "@/lib/chat/guards";
import { getFriendsDashboardData } from "@/lib/chat/friends";
import { listConversationsForUser } from "@/lib/chat/messages";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; c?: string; dm?: string }>;
}) {
  await assertChatEnabledOr404();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/messages");
  }
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  const [user, params] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        image: true,
        role: true,
        showOnlineStatus: true,
        chatTermsAcceptedAt: true,
        chatPublicTimeoutUntil: true,
        chatBannedAt: true,
        chatBannedReason: true,
      },
    }),
    searchParams,
  ]);

  if (!user) {
    redirect("/login");
  }

  const canLoadInitial = Boolean(user.chatTermsAcceptedAt && !user.chatBannedAt);
  const [initialConversations, initialFriends] = canLoadInitial
    ? await Promise.all([
        listConversationsForUser(user.id),
        getFriendsDashboardData(user.id),
      ])
    : [undefined, undefined];

  const requestedConvId = params.c?.trim() || null;
  const requestedDmPeerId = params.dm?.trim() || null;
  const matchedConv = requestedConvId
    ? initialConversations?.conversations.find((c) => c.id === requestedConvId)
    : undefined;

  let initialTab: ChatTab = "friends";
  if (params.tab === "rooms") initialTab = "rooms";
  else if (params.tab === "friends") initialTab = "friends";
  else if (matchedConv?.type === "ROOM") initialTab = "rooms";

  return (
    <PageBackground>
      <GlassNavbar initialSession={session} initialChatEnabled />
      <div className="pt-20 sm:pt-24">
        <ChatWorkspace
          scope="private"
          initialTab={initialTab}
          initialDmPeerId={requestedDmPeerId}
          actor={{
            id: user.id,
            name: user.name,
            image: user.image,
            role: user.role,
            showOnlineStatus: user.showOnlineStatus,
            chatPublicTimeoutUntil: user.chatPublicTimeoutUntil
              ? user.chatPublicTimeoutUntil.toISOString()
              : null,
          }}
          initialTermsAccepted={Boolean(user.chatTermsAcceptedAt)}
          initialConversationId={requestedConvId}
          initialConversations={initialConversations?.conversations}
          initialFriends={initialFriends}
          bannedReason={user.chatBannedAt ? user.chatBannedReason || "" : undefined}
        />
      </div>
    </PageBackground>
  );
}
