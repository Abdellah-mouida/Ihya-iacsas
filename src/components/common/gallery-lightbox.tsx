"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { getGalleryPhotos } from "@/app/actions/gallery";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";
import { EASE, fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 768px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

export function GalleryLightbox() {
  const { t, locale, dir } = useLocale();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const [dbItems, setDbItems] = useState<{ src: string; caption: string; w: number; h: number }[]>([]);

  useEffect(() => {
    getGalleryPhotos().then((res) => {
      if (res.success && res.photos && res.photos.length > 0) {
        setDbItems(
          res.photos.map((p) => ({
            src: p.imageUrl,
            caption:
              locale === "ar"
                ? p.captionAr || p.captionEn || "صورة من إحياء"
                : p.captionEn || p.captionAr || "Ihyaa moment",
            w: 1280,
            h: 960,
          })),
        );
      }
    });
  }, [locale]);

  const items =
    dbItems.length > 0
      ? dbItems
      : GALLERY.map((g) => ({
          src: g.src,
          caption: t(g.altKey),
          w: g.w,
          h: g.h,
        }));

  const count = items.length;

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
      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="columns-2 gap-4 md:columns-3 [&>*]:mb-4"
      >
        {items.map((item, i) => (
          // Non-button wrapper; inner button is the lightbox trigger.
          <motion.div
            key={item.src}
            variants={fadeUp}
            className="group glass relative break-inside-avoid overflow-hidden rounded-2xl shadow-layered transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-layered hover:ring-2 hover:ring-brass/30"
          >
            <button
              type="button"
              onClick={() => {
                setDirection(0);
                setIndex(i);
                setOpen(true);
              }}
              aria-label={t("gallery.view")}
              className="relative block w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src={item.src}
                alt={item.caption}
                width={item.w}
                height={item.h}
                sizes="(max-width: 768px) 50vw, 33vw"
                className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-night/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
                <ZoomIn className="size-7 text-white" />
              </span>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-night/80 to-transparent p-3 text-start text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {item.caption}
              </span>
            </button>
          </motion.div>
        ))}
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl border-brass/30 bg-background/95 p-2 sm:max-w-3xl">
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

            {/* Preload every gallery image at the lightbox size */}
            {open ? (
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0">
                {items.map((item, i) =>
                  i === index ? null : (
                    <Image
                      key={item.src}
                      src={item.src}
                      alt=""
                      fill
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
              aria-label="prev"
              onClick={() => go(dir === "rtl" ? 1 : -1)}
              className="glass absolute top-1/2 start-2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full text-foreground transition hover:scale-110 hover:text-brass"
            >
              <ChevronLeft className="size-5 rtl:hidden" />
              <ChevronRight className="hidden size-5 rtl:block" />
            </button>
            <button
              type="button"
              aria-label="next"
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
