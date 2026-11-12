"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getPublicGalleryPhotos } from "@/app/actions/gallery";
import { SectionHeading } from "@/components/common/section-heading";
import { InViewReveal } from "@/components/common/in-view-reveal";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { BlurImage } from "@/components/common/blur-image";
import { Button } from "@/components/ui/button";

type InitialGalleryPhoto = {
  id: string;
  imageUrl: string;
  blurDataUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  captionAr: string | null;
  captionEn: string | null;
  createdAt: Date;
};

type PhotoItem = {
  id: string;
  src: string;
  caption: string;
  createdAt: Date;
  dateKey: string;
  dateLabel: string;
  imageWidth: number | null;
  imageHeight: number | null;
  blurDataUrl?: string | null;
};

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 960px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

export function GalleryPageContent({
  initialPhotos,
  initialHasMore,
}: {
  initialPhotos: InitialGalleryPhoto[];
  initialHasMore: boolean;
}) {
  const { t, locale, dir } = useLocale();
  const [photoRows, setPhotoRows] = useState(initialPhotos);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Lightbox state
  const [open, setOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const photos = useMemo<PhotoItem[]>(() => {
    if (photoRows.length > 0) {
      return photoRows.map((photo) => {
        const date = new Date(photo.createdAt);
        return {
          id: photo.id,
          src: photo.imageUrl,
          blurDataUrl: photo.blurDataUrl,
          imageWidth: photo.imageWidth,
          imageHeight: photo.imageHeight,
          caption: locale === "ar"
            ? photo.captionAr || photo.captionEn || "صورة من إحياء"
            : photo.captionEn || photo.captionAr || "Ihyaa moment",
          createdAt: date,
          dateKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          dateLabel: date.toLocaleDateString(locale === "ar" ? "ar-MA" : "en-US", { year: "numeric", month: "long" }),
        };
      });
    }

    const fallbackDate = new Date();
    return GALLERY.map((item, index) => ({
      id: `static-${index}`,
      src: item.src,
      caption: t(item.altKey),
      createdAt: fallbackDate,
      dateKey: "archive",
      dateLabel: t("gallery.archiveGroup"),
      imageWidth: item.w,
      imageHeight: item.h,
    }));
  }, [locale, photoRows, t]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const result = await getPublicGalleryPhotos(photoRows.length, 12);
      if (result.success) {
        setPhotoRows((current) => [...current, ...result.photos]);
        setHasMore(result.hasMore);
      } else {
        setLoadMoreFailed(true);
      }
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, photoRows.length]);

  // Group photos by dateKey
  const groupedPhotos = useMemo(() => {
    const map = new Map<string, { label: string; date: Date; items: PhotoItem[] }>();

    for (const p of photos) {
      if (!map.has(p.dateKey)) {
        map.set(p.dateKey, {
          label: p.dateLabel,
          date: p.createdAt,
          items: [],
        });
      }
      map.get(p.dateKey)!.items.push(p);
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === "archive") return 1;
        if (b[0] === "archive") return -1;
        return b[1].date.getTime() - a[1].date.getTime();
      })
      .map(([key, group]) => ({
        key,
        label: group.label,
        items: group.items,
      }));
  }, [photos]);

  // Flattened photos for continuous lightbox browsing
  const flatPhotos = useMemo(() => {
    return groupedPhotos.flatMap((g) => g.items);
  }, [groupedPhotos]);

  const totalCount = flatPhotos.length;

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setLightboxIndex((i) => (i + delta + totalCount) % totalCount);
    },
    [totalCount],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(dir === "rtl" ? -1 : 1);
      if (e.key === "ArrowLeft") go(dir === "rtl" ? 1 : -1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, dir]);

  const current = flatPhotos[lightboxIndex];

  return (
    <div className="relative pt-36 pb-24 sm:pt-40 sm:pb-32 overflow-x-clip">
      {/* Ambient glow behind header */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 -z-10 h-72 w-[min(90vw,48rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_55%_55%_at_center,color-mix(in_oklch,var(--main)_14%,transparent)_0%,transparent_80%)]"
      />

      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("gallery.pageKicker")}
          title={t("gallery.pageTitle")}
          desc={t("gallery.pageDesc")}
        />

        {flatPhotos.length === 0 ? (
          <div className="mt-16 flex flex-col items-center justify-center rounded-3xl glass p-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25">
              <ImageIcon className="size-7" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-semibold">
              {t("gallery.emptyTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("gallery.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="mt-16 space-y-16">
            {groupedPhotos.map((group) => (
              <section key={group.key} className="space-y-6">
                {/* Date group heading */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-brass/15 text-brass">
                      <Calendar className="size-4" />
                    </span>
                    <h3 className="font-heading text-xl font-semibold text-foreground">
                      {group.label}
                    </h3>
                  </div>
                  <span className="rounded-full glass px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {t("gallery.photosCount", { count: group.items.length })}
                  </span>
                </div>

                {/* Group photos grid */}
                <InViewReveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => {
                    const globalIdx = flatPhotos.findIndex((p) => p.id === item.id);
                    return (
                      <div
                        key={item.id}
                        data-gallery-card
                        className="group glass relative overflow-hidden rounded-2xl shadow-layered transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-layered hover:ring-2 hover:ring-brass/35"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setDirection(0);
                            setLightboxIndex(globalIdx >= 0 ? globalIdx : 0);
                            setOpen(true);
                          }}
                          aria-label={item.caption}
                          className="relative block aspect-[4/3] w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden"
                        >
                          <BlurImage
                            src={item.src}
                            alt={item.caption}
                            fill
                            width={item.imageWidth}
                            height={item.imageHeight}
                            blurDataUrl={item.blurDataUrl}
                            priority={globalIdx === 0}
                            sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 1023px) calc((100vw - 4rem) / 2), calc((min(100vw, 72rem) - 7rem) / 3)"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {/* Inner gold border */}
                          <div className="pointer-events-none absolute inset-2.5 rounded-xl ring-1 ring-inset ring-gold/20 transition-all duration-300 group-hover:ring-gold/40" />

                          {/* Hover scrim + zoom icon */}
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-night/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <ZoomIn className="size-8 text-white" />
                          </span>

                          {/* Caption bar */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-night/85 via-night/40 to-transparent p-4 text-start text-sm font-medium text-white opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                            <p className="line-clamp-2">{item.caption}</p>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </InViewReveal>
              </section>
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="mt-10 flex justify-center">
            <div className="flex flex-col items-center gap-3">
              {loadMoreFailed ? <p role="alert" className="text-sm text-destructive">{t("gallery.loadMoreError")}</p> : null}
              <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" /> : null}
                {t(loadingMore ? "gallery.loadingMore" : "gallery.loadMore")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("gallery.close")} className="max-w-4xl border-brass/30 bg-background/95 p-3 sm:max-w-4xl">
          <DialogTitle className="sr-only">
            {current ? current.caption : ""}
          </DialogTitle>

          <div className="relative h-[65vh] w-full overflow-hidden rounded-xl sm:h-[75vh]">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              {current ? (
                <motion.div
                  key={current.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: EASE }}
                  className="absolute inset-0"
                >
                  <BlurImage
                    src={current.src}
                    alt={current.caption}
                    fill
                    width={current.imageWidth}
                    height={current.imageHeight}
                    blurDataUrl={current.blurDataUrl}
                    priority
                    sizes={LIGHTBOX_SIZES}
                    className="object-contain"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Navigation buttons */}
            <button
              type="button"
              aria-label={t("gallery.previousImage")}
              onClick={() => go(dir === "rtl" ? 1 : -1)}
              className="glass absolute top-1/2 start-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground transition-[transform,color] hover:scale-110 hover:text-brass"
            >
              <ChevronLeft className="size-6 rtl:hidden" />
              <ChevronRight className="hidden size-6 rtl:block" />
            </button>
            <button
              type="button"
              aria-label={t("gallery.nextImage")}
              onClick={() => go(dir === "rtl" ? -1 : 1)}
              className="glass absolute top-1/2 end-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground transition-[transform,color] hover:scale-110 hover:text-brass"
            >
              <ChevronRight className="size-6 rtl:hidden" />
              <ChevronLeft className="hidden size-6 rtl:block" />
            </button>
          </div>

          <div className="flex items-center justify-between px-2 pt-2 pb-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{current ? current.caption : ""}</p>
            <span className="text-xs">
              {lightboxIndex + 1} / {totalCount}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
