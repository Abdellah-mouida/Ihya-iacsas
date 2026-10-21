import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { ChangePasswordView } from "@/components/auth/change-password-view";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export const metadata: Metadata = {
  title: "تعيين كلمة مرور جديدة — برنامج إحياء | Set New Password — Ihyaa Program",
  description: "تعيين كلمة مرور جديدة لحسابك في برنامج إحياء.",
};

export default function ChangePasswordPage() {
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
          <ChangePasswordView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
