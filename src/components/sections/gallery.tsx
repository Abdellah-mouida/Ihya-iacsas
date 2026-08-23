"use client";

import dynamic from "next/dynamic";

import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";

function GallerySkeleton() {
  return (
    <div className="columns-2 gap-4 md:columns-3 [&>*]:mb-4">
      {GALLERY.map((item) => (
        <div
          key={item.src}
          style={{ aspectRatio: `${item.w} / ${item.h}` }}
          className="animate-pulse break-inside-avoid rounded-2xl bg-muted/60"
        />
      ))}
    </div>
  );
}

// Below the fold + heavy (7 images, dialog, motion): load as its own chunk.
const GalleryLightbox = dynamic(
  () =>
    import("@/components/common/gallery-lightbox").then(
      (m) => m.GalleryLightbox,
    ),
  { ssr: false, loading: () => <GallerySkeleton /> },
);

export function Gallery() {
  const { t } = useLocale();

  return (
    <section id="gallery" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("gallery.kicker")}
          title={t("gallery.title")}
          desc={t("gallery.desc")}
        />
        <div className="mt-14">
          <GalleryLightbox />
        </div>
      </div>
    </section>
  );
}
