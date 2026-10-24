import type { Metadata } from "next";

import { auth } from "@/auth";
import { PageTexture } from "@/components/common/page-texture";
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
      <main className="relative isolate min-h-screen overflow-hidden bg-background z-0">
        <PageTexture />
        <div className="relative z-10 pt-24">
          <GalleryPageContent />
        </div>
      </main>
      <Footer />
    </>
  );
}
