import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { LoginView } from "@/components/auth/login-view";
import { AuthAmbientBackdrop } from "@/components/auth/auth-ambient-backdrop";

export const metadata: Metadata = {
  title: "تسجيل الدخول — برنامج إحياء | Sign In — Ihyaa Program",
  description: "تسجيل الدخول إلى حسابك في برنامج إحياء لمتابعة الفعاليات وإدارة الحجوزات.",
};

export default function LoginPage() {
  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen pt-28 pb-16 px-4 flex flex-col items-center justify-center relative">
        <AuthAmbientBackdrop />
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12">
              <IslamicLoader size="lg" />
            </div>
          }
        >
          <LoginView />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
