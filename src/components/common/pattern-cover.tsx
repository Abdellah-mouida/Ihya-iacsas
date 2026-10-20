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

  // Check if this is one of the three preset pattern covers
  const isDefaultGirih = url === "/patterns/girih.svg" || url === "default";
  const isMandala = url === "/patterns/mandala.svg" || url === "mandala";
  const isOctagon = url === "/patterns/octagon-tile.svg" || url === "octagon";

  if (isDefaultGirih) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-emerald/40 via-background to-brass/30 ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--primary)",
            maskImage: "url(/patterns/girih.svg)",
            WebkitMaskImage: "url(/patterns/girih.svg)",
            maskRepeat: "repeat",
            WebkitMaskRepeat: "repeat",
            maskSize: thumbnail ? "48px 48px" : "120px 120px",
            WebkitMaskSize: thumbnail ? "48px 48px" : "120px 120px",
            opacity: 0.22,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>
    );
  }

  if (isMandala) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-brass/35 via-background to-emerald/25 ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--heading)",
            maskImage: "url(/patterns/mandala.svg)",
            WebkitMaskImage: "url(/patterns/mandala.svg)",
            maskRepeat: "repeat",
            WebkitMaskRepeat: "repeat",
            maskSize: thumbnail ? "60px 60px" : "150px 150px",
            WebkitMaskSize: thumbnail ? "60px 60px" : "150px 150px",
            opacity: 0.28,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>
    );
  }

  if (isOctagon) {
    return (
      <div
        className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-primary/30 via-background to-muted/40 ${className}`}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: "var(--foreground)",
            maskImage: "url(/patterns/octagon-tile.svg)",
            WebkitMaskImage: "url(/patterns/octagon-tile.svg)",
            maskRepeat: "repeat",
            WebkitMaskRepeat: "repeat",
            maskSize: thumbnail ? "40px 40px" : "100px 100px",
            WebkitMaskSize: thumbnail ? "40px 40px" : "100px 100px",
            opacity: 0.2,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
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
