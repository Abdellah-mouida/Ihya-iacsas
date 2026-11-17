"use client";

import { Image as ImageIcon } from "lucide-react";
import { useMemo } from "react";

import { DriftColumns, type DriftGalleryPhoto } from "@/components/DriftColumns";
import { PhotoZoom, usePhotoZoom } from "@/components/common/photo-zoom";
import { SectionHeading } from "@/components/common/section-heading";
import { useLowPower } from "@/hooks/use-low-power";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";

type InitialGalleryPhoto = {
  id: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  captionAr: string | null;
  captionEn: string | null;
  createdAt: Date | string;
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
  const { t, locale } = useLocale();
  const lowPower = useLowPower();
  const { zoomState, openZoom, closeZoom } = usePhotoZoom();

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
            onPhotoClick={(photo, sourceEl) =>
              openZoom(
                {
                  src: photo.src,
                  alt: photo.caption,
                  caption: photo.caption,
                  date: photo.dateLabel,
                  width: photo.imageWidth,
                  height: photo.imageHeight,
                },
                sourceEl,
              )
            }
          />
        </section>
      )}

      <PhotoZoom zoomState={zoomState} onClose={closeZoom} />
    </div>
  );
}
