import React from "react";
import Image from "next/image";

export interface PatternCoverProps {
  coverUrl: string | null | undefined;
  alt?: string;
  className?: string;
  thumbnail?: boolean;
}

/**
 * Renders profile covers with tiled SVG patterns for default presets,
 * or cover-fit image for custom uploaded covers.
 *
 * Presets:
 * 1. Default (/patterns/girih.svg): Rich emerald & brass geometric weave
 * 2. Mandala (/patterns/mandala.svg): Intricate floral Islamic mandala rosettes
 * 3. Octagon (/patterns/octagon-tile.svg): Elegant Moroccan octagonal tile lattice
 */
export function PatternCover({
  coverUrl,
  alt = "Profile Cover",
  className = "",
  thumbnail = false,
}: PatternCoverProps) {
  const url = coverUrl || "/patterns/girih.svg";

  // Check if this is the default tiled SVG pattern cover
  const isDefaultGirih =
    url === "/patterns/girih.svg" ||
    url === "default" ||
    url === "/patterns/mandala.svg" ||
    url === "mandala" ||
    url === "/patterns/octagon-tile.svg" ||
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
              "url(/patterns/girih.svg), linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)",
            WebkitMaskImage:
              "url(/patterns/girih.svg), linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)",
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
            maskRepeat: "repeat",
            WebkitMaskRepeat: "repeat",
            maskSize: thumbnail ? "48px 48px, 100% 100%" : "96px 96px, 100% 100%",
            WebkitMaskSize: thumbnail ? "48px 48px, 100% 100%" : "96px 96px, 100% 100%",
            opacity: 0.18,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>
    );
  }

  // Custom uploaded photo / image
  return (
    <div className={`relative w-full h-full overflow-hidden bg-muted/40 ${className}`}>
      <Image
        src={url}
        alt={alt}
        fill
        priority={!thumbnail}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
    </div>
  );
}
