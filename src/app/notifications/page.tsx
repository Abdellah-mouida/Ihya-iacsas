import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageBackground } from "@/components/common/page-background";
import { GlassNavbar } from "@/components/sections/glass-navbar";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/notifications");
  }
  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  return (
    <PageBackground>
      <GlassNavbar initialSession={session} />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:pt-32">
        <div
          data-testid="notifications-page-placeholder"
          className="rounded-3xl border border-border/60 bg-card/75 p-6 text-center text-sm text-muted-foreground backdrop-blur-md"
        />
      </main>
    </PageBackground>
  );
}
