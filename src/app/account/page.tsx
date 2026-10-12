import { Suspense } from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserAccountData } from "@/app/actions/account";
import { AccountView } from "@/components/account/account-view";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { Footer } from "@/components/sections/footer";

export const metadata: Metadata = {
  title: "حسابي | برنامج إحياء",
  description: "إدارة الحساب الشخصي والحجوزات في فعاليات برنامج إحياء",
};

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  if (!session.user.onboardingComplete) {
    redirect("/onboarding");
  }

  const res = await getUserAccountData();
  if (!res.success || !res.data) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <GlassNavbar initialSession={session} />
      <main className="flex-1 pt-24 sm:pt-28 pb-16">
        <Suspense
          fallback={
            <div
              data-testid="account-loading"
              className="w-full flex items-center justify-center py-20"
            >
              <IslamicLoader size="lg" message="جاري تحميل الحساب..." />
            </div>
          }
        >
          <AccountView initialData={res.data} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
