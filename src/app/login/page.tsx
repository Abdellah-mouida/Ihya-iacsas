import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { IslamicLoader } from "@/components/common/islamic-loader";

export const metadata: Metadata = {
  title: "تسجيل الدخول — إحياء | Sign In — Ihyaa",
  description: "تسجيل الدخول إلى حسابك في برنامج إحياء.",
};

export default function LoginPage() {
  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen pt-24 pb-12 flex flex-col items-center justify-center px-4">
        <Suspense fallback={<IslamicLoader size="lg" message="جاري التحميل..." />}>
          <div
            data-testid="login-view"
            className="w-full max-w-md p-8 rounded-3xl border border-brass/15 bg-card/70 backdrop-blur-2xl shadow-2xl text-center"
          >
            <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
              تسجيل الدخول | Sign In
            </h1>
            <p className="text-xs text-muted-foreground mb-6">
              أهلاً بك مجدداً في برنامج إحياء
            </p>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary mb-6">
              تم تأكيد حسابك بنجاح! يمكنك الآن تسجيل الدخول.
            </div>
            <Link
              href="/signup"
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              إنشاء حساب جديد | Sign Up
            </Link>
          </div>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
