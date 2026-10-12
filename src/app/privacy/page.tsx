import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { PrivacyView } from "@/components/pages/privacy-view";

export const metadata: Metadata = {
  title: "سياسة الخصوصية — إحياء | Privacy Policy",
  description:
    "سياسة الخصوصية وحماية البيانات الشخصية في منصة برنامج إحياء بالمغرب. Privacy policy and personal data protection for Ihyaa Program in Morocco.",
};

export default async function PrivacyPage() {
  const session = await auth();
  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="min-h-screen">
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          <PrivacyView />
        </div>
      </main>
      <Footer />
    </>
  );
}
