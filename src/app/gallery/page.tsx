import type { Metadata } from "next";

import { auth } from "@/auth";
import { getPublicGalleryPhotos } from "@/app/actions/gallery";
import { Footer } from "@/components/sections/footer";
import { GalleryPageContent } from "@/components/sections/gallery-page-content";
import { GlassNavbar } from "@/components/sections/glass-navbar";

export const metadata: Metadata = {
  title: "معرض الصور — إحياء | Ihyaa Gallery",
  description:
    "توثيق بالصور لمسيرة وفعاليات برنامج إحياء الشبابي عبر فروع المملكة. Photo moments and activities of the Ihyaa youth program across Morocco.",
};

export default async function GalleryPage() {
  const [session, gallery] = await Promise.all([auth(), getPublicGalleryPhotos(0, 12)]);
  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="relative isolate min-h-screen overflow-hidden z-0">
          <div className="relative z-10 pt-24">
          <GalleryPageContent initialPhotos={gallery.success ? gallery.photos : []} initialHasMore={gallery.hasMore} />
        </div>
      </main>
      <Footer />
    </>
  );
}
