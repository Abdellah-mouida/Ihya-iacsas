"use client";

import { GalleryLightbox } from "@/components/common/gallery-lightbox";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";

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
