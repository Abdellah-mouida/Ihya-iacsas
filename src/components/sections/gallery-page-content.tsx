"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DriftColumns, type DriftGalleryPhoto } from "@/components/DriftColumns";
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
  createdAt: Date | string;
};

const LIGHTBOX_SIZES = "(max-width: 768px) 92vw, 960px";

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "8%" : "-8%", scale: 0.98 }),
  center: { opacity: 1, x: "0%", scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? "-8%" : "8%", scale: 0.98 }),
};

function toGalleryThumbUrl(src: string): string {
  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/image/upload/")) {
    const [, after] = src.split("/image/upload/");
    if (after && !after.startsWith("w_") && !after.includes(",w_")) {
      return src.replace("/image/upload/", "/image/upload/f_auto,q_auto,c_limit,w_600/");
    }
  }
  return src;
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

  const [open, setOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const photos = useMemo<DriftGalleryPhoto[]>(() => {
    const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    if (initialPhotos.length > 0) {
      return initialPhotos.slice(0, 60).map((photo) => {
        const parsedDate = photo.createdAt ? new Date(photo.createdAt) : null;
        const dateLabel =
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? dateFormatter.format(parsedDate)
            : undefined;
        return {
          id: photo.id,
          src: photo.imageUrl,
          thumbSrc: toGalleryThumbUrl(photo.imageUrl),
          imageWidth: photo.imageWidth,
          imageHeight: photo.imageHeight,
          dateLabel,
          caption:
            locale === "ar"
              ? photo.captionAr || photo.captionEn || "صورة من إحياء"
              : photo.captionEn || photo.captionAr || "Ihyaa moment",
        };
      });
    }

    return GALLERY.slice(0, 60).map((item, index) => ({
      id: `static-${index}`,
      src: item.src,
      thumbSrc: toGalleryThumbUrl(item.src),
      caption: t(item.altKey),
      imageWidth: item.w,
      imageHeight: item.h,
    }));
  }, [initialPhotos, locale, t]);

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

      {photos.length === 0 ? (
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
          <DriftColumns
            photos={photos}
            shuffleSeed={shuffleSeed}
            lowPower={lowPower}
            ariaLabel={t("gallery.pageTitle")}
            onPhotoClick={(photo) => {
              const idx = photos.findIndex((p) => p.id === photo.id);
              setDirection(0);
              setLightboxIndex(idx >= 0 ? idx : 0);
              setOpen(true);
            }}
          />
        </section>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          closeLabel={t("gallery.close")}
          className="max-w-4xl border-brass/30 bg-background/95 p-3 sm:max-w-4xl"
        >
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
