import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertChatEnabledOr404 } from "@/lib/chat/guards";
import { inspectLinkInvite } from "@/lib/chat/rooms";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { InviteLandingView } from "@/components/chat/invite-landing-view";

export const metadata = {
  title: "دعوة غرفة خاصة | برنامج إحياء",
  description: "قبول أو رفض دعوة غرفة محادثة خاصة",
};

export default async function ChatInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await assertChatEnabledOr404();

  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/chat/invite/${token}`)}`,
    );
  }

  const viewer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      onboardingCompletedAt: true,
      chatBannedAt: true,
    },
  });

  if (!viewer || !viewer.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  let invite = null;
  if (!viewer.chatBannedAt) {
    try {
      invite = await inspectLinkInvite(viewer.id, token);
    } catch {
      invite = null;
    }
  }

  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="relative isolate min-h-screen overflow-hidden px-4 pt-28 pb-16 sm:px-6 lg:px-8">
        <div className="relative z-10 mx-auto max-w-2xl">
          <InviteLandingView token={token} invite={invite} />
        </div>
      </main>
    </>
  );
}
