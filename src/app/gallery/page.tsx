import type { Metadata } from "next";

import { Footer } from "@/components/sections/footer";
import { GalleryPageContent } from "@/components/sections/gallery-page-content";
import { GlassNavbar } from "@/components/sections/glass-navbar";

export const metadata: Metadata = {
  title: "معرض الصور — إحياء | Ihyaa Gallery",
  description:
    "توثيق بالصور لمسيرة وفعاليات برنامج إحياء الشبابي عبر فروع المملكة. Photo moments and activities of the Ihyaa youth program across Morocco.",
};

export default function GalleryPage() {
  return (
    <>
      <GlassNavbar />
      <main>
        {/* Ambient radial-gradient backdrop, consistent with the homepage and events page */}
        <div className="relative bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)]">
          <GalleryPageContent />
        </div>
      </main>
      <Footer />
    </>
  );
}
