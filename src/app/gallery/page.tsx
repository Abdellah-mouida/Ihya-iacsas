import type { Metadata } from "next";

import { auth } from "@/auth";
import { Texture } from "@/components/common/texture";
import { Footer } from "@/components/sections/footer";
import { GalleryPageContent } from "@/components/sections/gallery-page-content";
import { GlassNavbar } from "@/components/sections/glass-navbar";

export const metadata: Metadata = {
  title: "معرض الصور — إحياء | Ihyaa Gallery",
  description:
    "توثيق بالصور لمسيرة وفعاليات برنامج إحياء الشبابي عبر فروع المملكة. Photo moments and activities of the Ihyaa youth program across Morocco.",
};

export default async function GalleryPage() {
  const session = await auth();
  return (
    <>
      <GlassNavbar initialSession={session} />
      <main>
        {/* Ambient radial-gradient backdrop, consistent with the homepage and events page */}
        <div className="relative isolate overflow-hidden bg-background bg-fixed bg-[radial-gradient(55%_45%_at_18%_12%,color-mix(in_oklch,var(--brass)_9%,transparent),transparent_60%),radial-gradient(50%_50%_at_85%_72%,color-mix(in_oklch,var(--emerald)_10%,transparent),transparent_65%)] z-0">
          <Texture pattern="star-rosette" size={72} fade="vertical" />
          <div className="relative z-10">
            <GalleryPageContent />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
