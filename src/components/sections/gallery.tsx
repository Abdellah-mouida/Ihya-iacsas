"use client";

import { ArrowRight, Images } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
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
    <section id="gallery" className="relative overflow-x-clip py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("gallery.kicker")}
          title={t("gallery.title")}
          desc={t("gallery.desc")}
        />
        <div className="mt-14">
          <GalleryLightbox limit={8} />
        </div>

        <div className="mt-12 flex justify-center">
          <Button
            asChild
            variant="outline"
            className="glass group h-12 rounded-full border-foreground/20 px-8 text-base font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-brass/40 hover:bg-foreground/5 hover:shadow-layered dark:border-white/20 dark:text-white dark:hover:bg-white/10"
          >
            <Link href="/gallery" className="inline-flex items-center gap-2.5">
              <Images className="size-4 text-brass" />
              <span>{t("gallery.viewAll")}</span>
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
      {/* Bottom fade into program section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-b from-transparent to-background/50 dark:to-background/40"
      />
    </section>
  );
}
