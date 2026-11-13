"use client";

import { ArrowRight, Images } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { SectionHeading } from "@/components/common/section-heading";
import { InViewMount } from "@/components/common/in-view-mount";
import { SpotlightCard } from "@/components/common/spotlight-card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

function GallerySkeleton() {
  return (
    <div className="aspect-square max-h-[80svh] w-full animate-pulse rounded-2xl bg-muted/60 sm:aspect-video" />
  );
}

// Below the fold + heavy (ogl + gsap slider): load as its own chunk.
const HomeGallerySlider = dynamic(
  () =>
    import("@/components/sections/home-gallery-slider").then(
      (m) => m.HomeGallerySlider,
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
        <SpotlightCard className="glass relative mt-14 overflow-hidden rounded-3xl border border-brass/25 p-2 shadow-layered sm:p-4">
          <InViewMount minHeight={260} placeholder={<GallerySkeleton />}>
            <HomeGallerySlider limit={10} />
          </InViewMount>
        </SpotlightCard>

        <div className="mt-12 flex justify-center">
          <Button
            asChild
            variant="outline"
            className="glass group h-12 rounded-full border-foreground/20 px-8 text-base font-semibold text-foreground shadow-sm transition-[transform,border-color,background-color,box-shadow] hover:-translate-y-0.5 hover:border-brass/40 hover:bg-foreground/5 hover:shadow-layered dark:border-border/60 dark:hover:bg-accent/40"
          >
            <Link href="/gallery" className="inline-flex items-center gap-2.5">
              <Images className="size-4 text-brass" />
              <span>{t("gallery.viewAll")}</span>
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
