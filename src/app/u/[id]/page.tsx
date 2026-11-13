import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertChatEnabledOr404 } from "@/lib/chat/guards";
import { getPublicProfile } from "@/lib/chat/friends";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { PublicProfileView } from "@/components/profile/public-profile-view";

export const metadata = {
  title: "الملف العام | برنامج إحياء",
  description: "الملف العام للعضو في مجتمع إحياء",
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await assertChatEnabledOr404();

  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/u/${id}`)}`);
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
  if (viewer.chatBannedAt) {
    notFound();
  }

  const profile = await getPublicProfile(viewer.id, id);
  if (!profile) {
    notFound();
  }

  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="relative isolate min-h-screen pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden z-0">
        <div className="relative z-10 max-w-4xl mx-auto">
          <PublicProfileView initialProfile={profile} />
        </div>
      </main>
    </>
  );
}
