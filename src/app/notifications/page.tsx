import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isChatEnabled } from "@/lib/chat/guards";
import { listNotificationsForUser } from "@/lib/notifications";
import { PageBackground } from "@/components/common/page-background";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { NotificationsInbox } from "@/components/notifications/notifications-inbox";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/notifications");
  }
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  const [initialData, chatEnabled] = await Promise.all([
    listNotificationsForUser(session.user.id, { limit: 20, filter: "all" }),
    isChatEnabled(),
  ]);

  return (
    <PageBackground>
      <GlassNavbar initialSession={session} initialChatEnabled={chatEnabled} />
      <main>
        <NotificationsInbox
          initialItems={initialData.items}
          initialNextCursor={initialData.nextCursor}
          initialUnreadCount={initialData.unreadCount}
        />
      </main>
    </PageBackground>
  );
}
