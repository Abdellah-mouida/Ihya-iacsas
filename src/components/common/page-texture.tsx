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
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Seamless 160x160 userSpaceOnUse Girih pattern tile with outline-only strokes */}
          <pattern
            id={patternId}
            width="160"
            height="160"
            patternUnits="userSpaceOnUse"
            patternTransform={rotate ? `rotate(${rotate})` : undefined}
          >
            {/* Seamless Girih geometric strapwork: 100% outline-only, no fills, stroke ~1px */}
            <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              {/* Outer boundary interlacing octagram grid */}
              <rect x="0" y="0" width="160" height="160" strokeDasharray="none" />
              <rect x="20" y="20" width="120" height="120" />
              {/* Central rotated squares forming seamless 8-point girih rosette */}
              <rect x="40" y="40" width="80" height="80" transform="rotate(45 80 80)" />
              <rect x="40" y="40" width="80" height="80" />
              <circle cx="80" cy="80" r="28" />
              <circle cx="80" cy="80" r="12" />
              {/* Corner 8-point stars matching seamless tile repeats (0,0), (160,0), (0,160), (160,160) */}
              <circle cx="0" cy="0" r="24" />
              <circle cx="160" cy="0" r="24" />
              <circle cx="0" cy="160" r="24" />
              <circle cx="160" cy="160" r="24" />
              <line x1="0" y1="0" x2="40" y2="40" />
              <line x1="160" y1="0" x2="120" y2="40" />
              <line x1="0" y1="160" x2="40" y2="120" />
              <line x1="160" y1="160" x2="120" y2="120" />
              {/* Edge intersections */}
              <line x1="80" y1="0" x2="80" y2="20" />
              <line x1="80" y1="140" x2="80" y2="160" />
              <line x1="0" y1="80" x2="20" y2="80" />
              <line x1="140" y1="80" x2="160" y2="80" />
            </g>
          </pattern>

          {/* Mask for soft page-edge top/bottom fades */}
          <linearGradient id={`${maskId}-edge`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="2%" stopColor="#fff" stopOpacity="1" />
            <stop offset="98%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.3" />
          </linearGradient>

          <mask id={maskId}>
            <rect width="100%" height="100%" fill={`url(#${maskId}-edge)`} />
          </mask>
        </defs>

        {/* Render pattern strictly in theme texture color with master token opacity */}
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          mask={`url(#${maskId})`}
          className="text-[var(--texture-color,var(--main))]"
          style={{
            opacity: "var(--texture-opacity, 0.14)",
          }}
        />
      </svg>
    </div>
  );
}
