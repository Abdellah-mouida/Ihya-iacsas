import React from "react";
import { SmoothImage } from "@/components/common/smooth-image";

export interface PatternCoverProps {
  coverUrl: string | null | undefined;
  alt?: string;
  className?: string;
  thumbnail?: boolean;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

/**
 * Renders profile covers with tiled SVG patterns for default presets,
 * or cover-fit image for custom uploaded covers.
 *
 * Presets:
 * 1. Default (/patterns/girih.svg): Rich emerald & brass geometric weave
 * 2. Mandala (/patterns/mandala.svg): Intricate floral Islamic mandala rosettes
 * 3. Star Rosette (/patterns/star-rosette.svg): Elegant star rosette medallion
 */
export function PatternCover({
  coverUrl,
  alt = "Profile Cover",
  className = "",
  thumbnail = false,
  imageWidth,
  imageHeight,
}: PatternCoverProps) {
  const url = coverUrl || "/patterns/girih.svg";

  // Check if this is the default tiled SVG pattern cover
  const isDefaultGirih =
    url === "/patterns/girih.svg" ||
    url === "default" ||
    url === "/patterns/mandala.svg" ||
    url === "mandala" ||
    url === "/patterns/star-rosette.svg" ||
    url === "star-rosette" ||
    url === "octagon";

  if (isDefaultGirih) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-background via-card to-background ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--main)",
            maskImage:
              "url(/patterns/girih.svg), radial-gradient(ellipse at center, currentColor 0%, currentColor 60%, transparent 100%), linear-gradient(to bottom, currentColor 0%, currentColor 55%, transparent 100%)",
            WebkitMaskImage:
              "url(/patterns/girih.svg), radial-gradient(ellipse at center, currentColor 0%, currentColor 60%, transparent 100%), linear-gradient(to bottom, currentColor 0%, currentColor 55%, transparent 100%)",
            maskComposite: "intersect, intersect",
            WebkitMaskComposite: "source-in, source-in",
            maskRepeat: "repeat",
            WebkitMaskRepeat: "repeat",
            maskSize: thumbnail ? "48px 48px, 100% 100%, 100% 100%" : "120px 120px, 100% 100%, 100% 100%",
            WebkitMaskSize: thumbnail ? "48px 48px, 100% 100%, 100% 100%" : "120px 120px, 100% 100%, 100% 100%",
            opacity: 0.22,
          }}
          data-testid="cover-pattern-tile"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 58%, var(--background) 100%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>
    );
  }

  // Custom uploaded photo / image
  return (
    <div className={`relative w-full h-full overflow-hidden bg-muted/40 ${className}`}>
      <SmoothImage
        src={url}
        alt={alt}
        fill
        width={imageWidth ?? 1280}
        height={imageHeight ?? 720}
        priority={!thumbnail}
        className="object-cover"
        data-testid="cover-upload-image"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
    </div>
  );
}
