import type { Metadata } from "next";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { SignUpView } from "@/components/auth/signup-view";

export const metadata: Metadata = {
  title: "إنشاء حساب جديد — إحياء | Sign Up — Ihyaa",
  description:
    "أنشئ حسابك في برنامج إحياء لتتمكن من حجز مقاعدك في الفعاليات والمجالس ومتابعة التسجيلات.",
};

export default function SignUpPage() {
  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen pt-16 sm:pt-20">
        <SignUpView />
      </main>
      <Footer />
    </>
  );
}
