import { randomInt } from "node:crypto";
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

function createShuffleSeed() {
  return randomInt(1, 1_000_000);
}

export default async function GalleryPage() {
  const [session, gallery] = await Promise.all([auth(), getPublicGalleryPhotos(0, 36)]);
  const shuffleSeed = createShuffleSeed();
  return (
    <>
      <GlassNavbar initialSession={session} />
      <main className="relative isolate flex min-h-screen flex-col overflow-hidden z-0">
        <div className="relative z-10 flex flex-1 flex-col pt-24">
          <GalleryPageContent
            initialPhotos={gallery.success ? gallery.photos : []}
            shuffleSeed={shuffleSeed}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
