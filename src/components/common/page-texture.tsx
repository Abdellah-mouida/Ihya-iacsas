"use client";

import React, { useId } from "react";
import { cn } from "@/lib/utils";

interface PageTextureProps {
  className?: string;
  rotate?: number;
  pattern?: "star-rosette" | "girih" | "mandala";
}

/**
 * Single site-wide / page-wide background texture layer.
 * Positioned absolute across the full scrollable page document (top 0 to bottom 0).
 *
 * Design Architecture:
 * 1. Single continuous SVG pattern tile across the whole page (no per-section breaks or seams).
 * 2. Sparse layout: small motif (~28-30% of cell) with generous breathing space and brick offset.
 * 3. Color strictly follows `var(--main)`.
 * 4. Dual radial/linear overlay fades:
 *    - Central column soft radial dim so content stays easily readable.
 *    - Lateral gutters show crisp motifs.
 *    - Subtle top and bottom page fades.
 */
export function PageTexture({
  className,
  rotate,
  pattern = "star-rosette",
}: PageTextureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9-_]/g, "");
  const patternId = `page-texture-pat-${uid}`;
  const maskId = `page-texture-mask-${uid}`;

  return (
    <div
      data-testid="page-texture-layer"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 h-full w-full overflow-hidden select-none",
        className
      )}
    >
      {/* 1. Underlying SVG Pattern Layer */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Sparse pattern tile with staggered / brick layout feel */}
          <pattern
            id={patternId}
            width="var(--texture-size, 140px)"
            height="var(--texture-size, 140px)"
            patternUnits="userSpaceOnUse"
            patternTransform={rotate ? `rotate(${rotate})` : "rotate(var(--texture-rotate, 0deg))"}
          >
            {/* Centered motif scaled to ~28% inside the cell, leaving generous space around */}
            <g transform="translate(70, 70) scale(var(--texture-motif, 0.28)) translate(-500, -500)">
              <image
                href="/patterns/star-rosette.svg"
                width="1000"
                height="1000"
                preserveAspectRatio="xMidYMid meet"
              />
            </g>
          </pattern>

          {/* Mask for soft radial center column dim & page-edge fades */}
          <linearGradient id={`${maskId}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="3%" stopColor="#fff" stopOpacity="1" />
            <stop offset="97%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.3" />
          </linearGradient>

          <mask id={maskId}>
            <rect width="100%" height="100%" fill={`url(#${maskId}-edge)`} />
          </mask>
        </defs>

        {/* Render pattern in theme texture color with master opacity */}
        <rect
          width="100%"
          height="100%"
          fill="var(--texture-color, var(--main))"
          mask={`url(#${maskId})`}
          style={{
            maskImage: `url(#${patternId})`,
            WebkitMaskImage: `url(#${patternId})`,
            opacity: "var(--texture-opacity, 0.24)",
          }}
        />

        {/* Fallback direct pattern overlay for wide SVG engine support */}
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId})`}
          style={{
            mixBlendMode: "luminosity",
            opacity: "calc(var(--texture-opacity, 0.24) * 0.9)",
          }}
        />
      </svg>
    </div>
  );
}
