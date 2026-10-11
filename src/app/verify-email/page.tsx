import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { VerifyEmailView } from "@/components/auth/verify-email-view";
import { IslamicLoader } from "@/components/common/islamic-loader";

export const metadata: Metadata = {
  title: "تأكيد البريد الإلكتروني — إحياء | Verify Email — Ihyaa",
  description: "أدخل رمز التحقق لتأكيد حسابك في برنامج إحياء.",
};

export default function VerifyEmailPage() {
  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen pt-16 sm:pt-20">
        <Suspense
          fallback={
            <div className="min-h-[60vh] flex items-center justify-center">
              <IslamicLoader size="lg" message="جاري التحميل..." />
            </div>
          }
        >
          <VerifyEmailView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
