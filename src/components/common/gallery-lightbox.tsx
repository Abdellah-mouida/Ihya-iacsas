"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmoothImage } from "@/components/common/smooth-image";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getGalleryPhotos } from "@/app/actions/gallery";
import CircularCarousel from "@/components/CircularCarousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { useLowPower } from "@/hooks/use-low-power";
import { GALLERY } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { InViewReveal } from "@/components/common/in-view-reveal";

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 768px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

export type LightboxItem = {
  src: string;
  caption: string;
  w?: number;
  h?: number;
};

export function GalleryLightbox({
  limit,
  initialItems,
}: {
  limit?: number;
  initialItems?: LightboxItem[];
} = {}) {
  const { t, locale, dir } = useLocale();
  const lowPower = useLowPower();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [dbItems, setDbItems] = useState<LightboxItem[]>([]);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) return;
    getGalleryPhotos().then((res) => {
      if (res.success && res.photos && res.photos.length > 0) {
        setDbItems(
          res.photos.map((p) => ({
            src: p.imageUrl,
            caption:
              locale === "ar"
                ? p.captionAr || p.captionEn || "صورة من إحياء"
                : p.captionEn || p.captionAr || "Ihyaa moment",
            w: p.imageWidth ?? 1280,
            h: p.imageHeight ?? 960,
          })),
        );
      }
    });
  }, [locale, initialItems]);

  const rawItems =
    initialItems && initialItems.length > 0
      ? initialItems.map((i) => ({
          src: i.src,
          caption: i.caption,
          w: i.w || 1280,
          h: i.h || 960,
        }))
      : dbItems.length > 0
        ? dbItems
        : GALLERY.map((g) => ({
            src: g.src,
            caption: t(g.altKey),
            w: g.w,
            h: g.h,
          }));

  const items = useMemo(
    () => (limit ? rawItems.slice(0, limit) : rawItems),
    [limit, rawItems],
  );

  const count = items.length;

  const carouselItems = useMemo(() => {
    if (!items.length) return [];
    const minSlots = 8;
    const totalSlots = items.length < minSlots ? Math.ceil(minSlots / items.length) * items.length : items.length;
    return Array.from({ length: totalSlots }, (_, slotIndex) => {
      const sourceIndex = slotIndex % items.length;
      const item = items[sourceIndex];
      return {
        src: item.src,
        alt: item.caption,
        title: item.caption,
        ariaLabel: `${t("gallery.view")}: ${item.caption}`,
        sourceIndex,
      };
    });
  }, [items, t]);

  const handleCarouselItemClick = useCallback(
    (item?: { sourceIndex?: number }, fallbackIndex?: number) => {
      if (!count) return;
      const targetIndex = item?.sourceIndex ?? (fallbackIndex ?? 0) % count;
      setDirection(0);
      setIndex(targetIndex);
      setOpen(true);
    },
    [count],
  );

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
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

  const current = items[index];

  return (
    <>
      <InViewReveal>
        <div className="relative h-[260px] w-full sm:h-[360px] md:h-[440px] lg:h-[520px]">
          <CircularCarousel
            data-rb="CircularCarousel"
            ariaLabel={t("gallery.title")}
            items={carouselItems}
            preset="panorama"
            intro={lowPower ? "none" : "rise"}
            cardWidth={320}
            aspectRatio={1.333}
            speed={14}
            captions={false}
            gap={15}
            tilt={0}
            curve={1}
            perspective={1800}
            autoplay={lowPower ? "off" : "drift"}
            interval={3}
            direction="left"
            momentum={0.6}
            snap
            pauseOnHover={false}
            focusOnClick
            draggable={false}
            parallax={lowPower ? 0 : 0.3}
            stretch={lowPower ? 0 : 0.5}
            fadeColor="var(--background)"
            depthFade={0.55}
            innerShade={0.6}
            cornerRadius={12}
            onItemClick={handleCarouselItemClick}
          />
        </div>
      </InViewReveal>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent closeLabel={t("gallery.close")} className="max-w-3xl border-brass/30 bg-background/95 p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {current ? current.caption : ""}
          </DialogTitle>

          <div className="relative h-[60vh] w-full overflow-hidden rounded-xl sm:h-[72vh]">
            {/* Animated current image (slide + fade between images). */}
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              {current ? (
                <motion.div
                  key={index}
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
                    width={current.w}
                    height={current.h}
                    priority
                    sizes={LIGHTBOX_SIZES}
                    className="object-contain"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Preload every gallery image at the lightbox size */}
            {open ? (
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0">
                {items.map((item, i) =>
                  i === index ? null : (
                    <SmoothImage
                      key={item.src}
                      src={item.src}
                      alt=""
                      fill
                      width={item.w}
                      height={item.h}
                      loading="eager"
                      sizes={LIGHTBOX_SIZES}
                      className="object-contain"
                    />
                  ),
                )}
              </div>
            ) : null}

            <button
              type="button"
              aria-label={t("gallery.previousImage")}
              onClick={() => go(dir === "rtl" ? 1 : -1)}
              className="glass absolute top-1/2 start-2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full text-foreground transition hover:scale-110 hover:text-brass"
            >
              <ChevronLeft className="size-5 rtl:hidden" />
              <ChevronRight className="hidden size-5 rtl:block" />
            </button>
            <button
              type="button"
              aria-label={t("gallery.nextImage")}
              onClick={() => go(dir === "rtl" ? -1 : 1)}
              className="glass absolute top-1/2 end-2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full text-foreground transition hover:scale-110 hover:text-brass"
            >
              <ChevronRight className="size-5 rtl:hidden" />
              <ChevronLeft className="hidden size-5 rtl:block" />
            </button>
          </div>
          <p className="pt-1 pb-2 text-center text-sm text-muted-foreground">
            {current ? current.caption : ""}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
