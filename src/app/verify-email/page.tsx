import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { VerifyEmailView } from "@/components/auth/verify-email-view";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export const metadata: Metadata = {
  title: "تأكيد البريد الإلكتروني — برنامج إحياء | Verify Email — Ihyaa Program",
  description: "أدخل رمز التحقق لتأكيد حسابك في برنامج إحياء.",
};

export default function VerifyEmailPage() {
  return (
    <>
      <GlassNavbar />
      <main className="relative isolate min-h-screen pt-28 pb-16 px-4 flex flex-col items-center justify-center bg-background overflow-hidden z-0">
        <AuthAmbientBackdrop pattern="girih" />
        <div className="relative z-10 w-full max-w-lg">
          <Suspense
            fallback={
              <div className="flex items-center justify-center p-12">
                <IslamicLoader size="lg" />
              </div>
            }
          >
            <VerifyEmailView />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}
