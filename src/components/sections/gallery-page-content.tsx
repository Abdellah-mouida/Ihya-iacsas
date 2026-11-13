"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import DriftWall from "@/components/DriftWall";
import { SectionHeading } from "@/components/common/section-heading";
import { SmoothImage } from "@/components/common/smooth-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLowPower } from "@/hooks/use-low-power";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";
import { EASE } from "@/lib/motion";

type InitialGalleryPhoto = {
  id: string;
  imageUrl: string;
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
  imageWidth: number | null;
  imageHeight: number | null;
};

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 960px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

function createSeededRng(seed: number) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(list: T[], seed: number): T[] {
  const copy = [...list];
  const nextRand = createSeededRng(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function useMediaMatches(query: string, fallback: boolean) {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(query).matches : fallback),
    () => fallback,
  );
}

export function GalleryPageContent({
  initialPhotos,
  shuffleSeed = 1,
}: {
  initialPhotos: InitialGalleryPhoto[];
  shuffleSeed?: number;
}) {
  const { t, locale, dir } = useLocale();
  const lowPower = useLowPower();
  const isTablet = useMediaMatches("(min-width: 640px)", false);
  const isDesktop = useMediaMatches("(min-width: 1024px)", true);

  const [open, setOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const photos = useMemo<PhotoItem[]>(() => {
    const base =
      initialPhotos.length > 0
        ? initialPhotos.map((photo) => ({
            id: photo.id,
            src: photo.imageUrl,
            imageWidth: photo.imageWidth,
            imageHeight: photo.imageHeight,
            caption:
              locale === "ar"
                ? photo.captionAr || photo.captionEn || "صورة من إحياء"
                : photo.captionEn || photo.captionAr || "Ihyaa moment",
          }))
        : GALLERY.map((item, index) => ({
            id: `static-${index}`,
            src: item.src,
            caption: t(item.altKey),
            imageWidth: item.w,
            imageHeight: item.h,
          }));

    return seededShuffle(base, shuffleSeed);
  }, [initialPhotos, locale, shuffleSeed, t]);

  const wallItems = useMemo(
    () =>
      photos.map((photo, index) => ({
        image: photo.src,
        title: photo.caption,
        width: photo.imageWidth,
        height: photo.imageHeight,
        sourceIndex: index,
      })),
    [photos],
  );

  const totalCount = photos.length;

  const go = useCallback(
    (delta: number) => {
      if (totalCount === 0) return;
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

  const wallConfig = isDesktop
    ? { columns: 5, tileWidth: 210, tileHeight: 140, gap: 20, tilt: 16, turn: 14, depth: 120, lift: 64, speed: 40 }
    : isTablet
      ? { columns: 4, tileWidth: 168, tileHeight: 114, gap: 14, tilt: 14, turn: 12, depth: 96, lift: 46, speed: 34 }
      : { columns: 3, tileWidth: 124, tileHeight: 88, gap: 12, tilt: 12, turn: 10, depth: 76, lift: 34, speed: 28 };

  const current = photos[lightboxIndex];

  return (
    <div className="relative isolate flex flex-1 flex-col pt-10 pb-8 sm:pt-14 sm:pb-12 overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-4 z-[1] h-64 w-[min(92vw,48rem)] -translate-x-1/2 bg-[radial-gradient(ellipse_55%_55%_at_center,color-mix(in_oklch,var(--main)_14%,transparent)_0%,transparent_80%)]"
      />

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5">
        <SectionHeading
          kicker={t("gallery.pageKicker")}
          title={t("gallery.pageTitle")}
          desc={t("gallery.pageDesc")}
          divider={false}
        />
      </div>

      {wallItems.length === 0 ? (
        <div className="relative z-10 mx-auto mt-16 flex max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass">
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
        <section
          aria-label={t("gallery.pageTitle")}
          className="relative z-10 mt-4 w-full flex-1 sm:mt-6"
        >
          <div className="h-[62svh] min-h-[420px] w-full sm:h-[68svh] sm:min-h-[520px] lg:h-[74svh] lg:min-h-[600px]">
            <DriftWall
              data-rb="DriftWall"
              items={wallItems}
              columns={wallConfig.columns}
              tileWidth={wallConfig.tileWidth}
              tileHeight={wallConfig.tileHeight}
              gap={wallConfig.gap}
              radius={14}
              tilt={wallConfig.tilt}
              turn={dir === "rtl" ? wallConfig.turn : -wallConfig.turn}
              roll={0}
              perspective={1200}
              depth={wallConfig.depth}
              speed={wallConfig.speed}
              direction="up"
              variance={0.48}
              parallax={lowPower ? 0 : 0.6}
              pauseOnHover={false}
              lift={wallConfig.lift}
              fade={0.58}
              dim={0.84}
              grayscale={false}
              overlayColor="var(--background)"
              seed={shuffleSeed}
              lowPower={lowPower}
              ariaLabel={t("gallery.pageTitle")}
              onItemClick={(_item: unknown, sourceIndex: number) => {
                setDirection(0);
                setLightboxIndex(sourceIndex);
                setOpen(true);
              }}
            />
          </div>
        </section>
      )}

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
                  <SmoothImage
                    src={current.src}
                    alt={current.caption}
                    fill
                    width={current.imageWidth}
                    height={current.imageHeight}
                    priority
                    sizes={LIGHTBOX_SIZES}
                    className="object-contain"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

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
