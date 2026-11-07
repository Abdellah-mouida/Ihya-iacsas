import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { TermsView } from "@/components/pages/terms-view";

export const metadata: Metadata = {
  title: "شروط الخدمة — إحياء | Terms of Service",
  description:
    "شروط الخدمة والاستخدام المنظمة لمنصة برنامج إحياء الشبابي وفعالياته بالمغرب. Terms governing the Ihyaa Program platform and events in Morocco.",
};

export default async function TermsPage() {
  const session = await auth();
  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="min-h-screen">
        <div className="relative">
          <TermsView />
        </div>
      </main>
      <Footer />
    </>
  );
}
