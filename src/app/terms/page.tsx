import type { Metadata } from "next";

import { Footer } from "@/components/sections/footer";
import { GlassNavbar } from "@/components/sections/glass-navbar";
import { TermsView } from "@/components/pages/terms-view";

export const metadata: Metadata = {
  title: "شروط الخدمة — إحياء | Terms of Service",
  description:
    "شروط الخدمة والاستخدام المنظمة لمنصة برنامج إحياء الشبابي وفعالياته بالمغرب. Terms governing the Ihyaa Program platform and events in Morocco.",
};

export default function TermsPage() {
  return (
    <>
      <GlassNavbar />
      <main className="min-h-screen">
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          <TermsView />
        </div>
      </main>
      <Footer />
    </>
  );
}
