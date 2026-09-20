"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Image as ImageIcon, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getGalleryPhotos } from "@/app/actions/gallery";
import { SectionHeading } from "@/components/common/section-heading";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";
import { EASE, fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

type PhotoItem = {
  id: string;
  src: string;
  caption: string;
  createdAt: Date;
  dateKey: string;
  dateLabel: string;
};

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 960px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

export function GalleryPageContent() {
  const { t, locale, dir } = useLocale();
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Lightbox state
  const [open, setOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    getGalleryPhotos().then((res) => {
      if (res.success && res.photos && res.photos.length > 0) {
        const formatted = res.photos.map((p) => {
          const date = new Date(p.createdAt);
          const dateLabel = date.toLocaleDateString(
            locale === "ar" ? "ar-MA" : "en-US",
            { year: "numeric", month: "long" },
          );
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          return {
            id: p.id,
            src: p.imageUrl,
            caption:
              locale === "ar"
                ? p.captionAr || p.captionEn || "صورة من إحياء"
                : p.captionEn || p.captionAr || "Ihyaa moment",
            createdAt: date,
            dateKey,
            dateLabel,
          };
        });
        setPhotos(formatted);
      } else {
        // Fallback to static gallery
        const fallbackDate = new Date();
        const fallback = GALLERY.map((g, idx) => ({
          id: `static-${idx}`,
          src: g.src,
          caption: t(g.altKey),
          createdAt: fallbackDate,
          dateKey: "archive",
          dateLabel: t("gallery.archiveGroup"),
        }));
        setPhotos(fallback);
      }
      setLoading(false);
    });
  }, [locale, t]);

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
        className="bg-brass-gradient pointer-events-none absolute left-1/2 top-24 -z-10 size-80 max-w-[85vw] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
      />

      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("gallery.pageKicker")}
          title={t("gallery.pageTitle")}
          desc={t("gallery.pageDesc")}
        />

        {loading ? (
          <div className="mt-16 space-y-12">
            {[1, 2].map((group) => (
              <div key={group} className="space-y-6">
                <div className="h-8 w-48 animate-pulse rounded-lg bg-muted/60" />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="aspect-[4/3] animate-pulse rounded-2xl bg-muted/50"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : flatPhotos.length === 0 ? (
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
                <motion.div
                  variants={staggerContainer(0.08)}
                  initial="hidden"
                  whileInView="show"
                  viewport={viewportOnce}
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {group.items.map((item) => {
                    const globalIdx = flatPhotos.findIndex((p) => p.id === item.id);
                    return (
                      <motion.div
                        key={item.id}
                        variants={fadeUp}
                        className="group glass relative overflow-hidden rounded-2xl shadow-layered transition-all duration-300 hover:-translate-y-1.5 hover:shadow-layered hover:ring-2 hover:ring-brass/35"
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
                          <Image
                            src={item.src}
                            alt={item.caption}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          {/* Inner gold border */}
                          <div className="pointer-events-none absolute inset-2.5 rounded-xl ring-1 ring-inset ring-gold/20 transition-all duration-300 group-hover:ring-gold/40" />

                          {/* Hover scrim + zoom icon */}
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-night/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
                            <ZoomIn className="size-8 text-white" />
                          </span>

                          {/* Caption bar */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-night/85 via-night/40 to-transparent p-4 text-start text-sm font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                            <p className="line-clamp-2">{item.caption}</p>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-brass/30 bg-background/95 p-3 sm:max-w-4xl">
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
                  <Image
                    src={current.src}
                    alt={current.caption}
                    fill
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
              aria-label="prev"
              onClick={() => go(dir === "rtl" ? 1 : -1)}
              className="glass absolute top-1/2 start-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground transition hover:scale-110 hover:text-brass"
            >
              <ChevronLeft className="size-6 rtl:hidden" />
              <ChevronRight className="hidden size-6 rtl:block" />
            </button>
            <button
              type="button"
              aria-label="next"
              onClick={() => go(dir === "rtl" ? -1 : 1)}
              className="glass absolute top-1/2 end-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground transition hover:scale-110 hover:text-brass"
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
