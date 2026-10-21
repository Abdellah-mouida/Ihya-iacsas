import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { OnboardingView } from "@/components/auth/onboarding-view";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export const metadata: Metadata = {
  title: "إعداد الملف الشخصي — برنامج إحياء | Profile Setup — Ihyaa Program",
  description: "أكمل إعداد ملفك الشخصي في برنامج إحياء لتخصيص تجربتك والوصول إلى حجز الفعاليات.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params?.callbackUrl || "/";

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      city: true,
      age: true,
      image: true,
      termsAcceptedAt: true,
      onboardingCompletedAt: true,
    },
  });

  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  if (user.onboardingCompletedAt) {
    redirect(callbackUrl);
  }

  const initialProfile = {
    name: user.name,
    email: user.email,
    city: user.city,
    age: user.age,
    image: user.image,
    termsAccepted: Boolean(user.termsAcceptedAt),
    onboardingCompleted: false,
  };

  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen pt-28 pb-16 px-4 flex flex-col items-center justify-center relative">
        <AuthAmbientBackdrop pattern="girih" />
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12">
              <IslamicLoader size="lg" />
            </div>
          }
        >
          <OnboardingView initialProfile={initialProfile} />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
