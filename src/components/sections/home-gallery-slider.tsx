"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { getGalleryPhotos } from "@/app/actions/gallery";
import { MorphCrossfade } from "@/components/morph-crossfade";
import { useLowPower } from "@/hooks/use-low-power";
import { useLocale } from "@/i18n/locale-provider";
import { GALLERY } from "@/lib/content";

const MorphSlider = dynamic(() => import("@/components/MorphSlider"), { ssr: false });

type RawPhoto = {
  imageUrl: string;
  captionAr: string | null;
  captionEn: string | null;
  createdAt?: Date | string | null;
};

function subscribeViewport(cb: () => void) {
  window.addEventListener("resize", cb, { passive: true });
  return () => window.removeEventListener("resize", cb);
}

function getIsMobileSnapshot() {
  return window.innerWidth <= 640;
}

function toSliderImageUrl(src: string, mobile: boolean): string {
  const width = mobile ? 828 : 1200;
  if (src.startsWith("https://res.cloudinary.com/") && src.includes("/image/upload/")) {
    const [, after] = src.split("/image/upload/");
    if (after && !after.startsWith("w_") && !after.includes(",w_")) {
      return src.replace(
        "/image/upload/",
        `/image/upload/f_auto,q_auto,c_limit,w_${mobile ? 800 : 1280}/`,
      );
    }
    return src;
  }
  if (src.startsWith("/")) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
  }
  return src;
}

export function HomeGallerySlider({ limit = 10 }: { limit?: number }) {
  const { t, locale, dir } = useLocale();
  const lowPower = useLowPower();
  const isMobile = useSyncExternalStore(subscribeViewport, getIsMobileSnapshot, () => false);
  const [dbPhotos, setDbPhotos] = useState<RawPhoto[]>([]);

  useEffect(() => {
    let active = true;
    getGalleryPhotos().then((res) => {
      if (!active || !res.success || !res.photos || res.photos.length === 0) return;
      setDbPhotos(res.photos.slice(0, limit));
    });
    return () => {
      active = false;
    };
  }, [limit]);

  const items = useMemo(() => {
    const dateFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    if (dbPhotos.length > 0) {
      return dbPhotos.map((photo) => {
        const caption =
          locale === "ar"
            ? photo.captionAr || photo.captionEn || t("gallery.altGathering")
            : photo.captionEn || photo.captionAr || t("gallery.altGathering");
        const parsedDate = photo.createdAt ? new Date(photo.createdAt) : null;
        const date =
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? dateFormatter.format(parsedDate)
            : undefined;
        return {
          image: toSliderImageUrl(photo.imageUrl, isMobile),
          rawImage: photo.imageUrl,
          alt: caption,
          caption,
          date,
        };
      });
    }

    return GALLERY.slice(0, limit).map((item) => {
      const caption = t(item.altKey);
      return {
        image: toSliderImageUrl(item.src, isMobile),
        rawImage: item.src,
        alt: caption,
        caption,
      };
    });
  }, [dbPhotos, isMobile, limit, locale, t]);

  const labels = useMemo(
    () => ({
      sliderLabel: t("gallery.sliderLabel"),
      slidesLabel: t("gallery.slidesLabel"),
      previousSlide: t("gallery.previousSlide"),
      nextSlide: t("gallery.nextSlide"),
      goToSlide: t("gallery.goToSlide"),
    }),
    [t],
  );

  return (
    <div className="relative aspect-square max-h-[80svh] w-full sm:aspect-video">
      {lowPower ? (
        <MorphCrossfade
          items={items}
          autoplay
          autoplayDelay={3}
          dir={dir}
          labels={labels}
          className="!absolute inset-0"
        />
      ) : (
        <MorphSlider
          items={items}
          transition="melt"
          duration={1.0}
          intensity={0.38}
          scale={2.2}
          aberration={0.22}
          drift={0.25}
          autoplay
          autoplayDelay={3}
          lowPower={lowPower}
          dir={dir}
          labels={labels}
          className="!absolute inset-0"
        />
      )}
    </div>
  );
}
