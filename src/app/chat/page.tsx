import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { assertChatEnabledOr404 } from "@/lib/chat/guards";
import { listConversationsForUser } from "@/lib/chat/messages";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الدردشة العامة — إحياء | Ihyaa Public chat",
  description:
    "الدردشة العامة لبرنامج إحياء الشبابي. Public chat for Ihyaa youth program members.",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; dm?: string }>;
}) {
  await assertChatEnabledOr404();

  const params = await searchParams;
  if (params.dm?.trim()) {
    redirect(`/messages?tab=friends&dm=${encodeURIComponent(params.dm.trim())}`);
  }
  if (params.c?.trim()) {
    redirect(`/messages?c=${encodeURIComponent(params.c.trim())}`);
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/chat");
  }
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  const user = await prisma.user.findUnique({
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
  });

  if (!user) {
    redirect("/login");
  }

  const canLoadInitial = Boolean(user.chatTermsAcceptedAt && !user.chatBannedAt);
  const initialConversations = canLoadInitial
    ? await listConversationsForUser(user.id, { publicOnly: true })
    : undefined;

  return (
    <PageBackground>
      <GlassNavbar initialSession={session} initialChatEnabled />
      <div className="pt-20 sm:pt-24">
        <ChatWorkspace
          scope="public"
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
          initialConversationId={null}
          initialConversations={initialConversations?.conversations}
          bannedReason={user.chatBannedAt ? user.chatBannedReason || "" : undefined}
        />
      </div>
    </PageBackground>
  );
}
