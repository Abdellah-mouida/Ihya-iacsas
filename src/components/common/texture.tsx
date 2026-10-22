import { useId } from "react";
import { cn } from "@/lib/utils";

export type TexturePattern =
  | "girih"
  | "octagon-tile"
  | "star-rosette"
  | "mandala"
  | "interlocking"
  | "octagon-grid";

export type TextureFade = "radial" | "vertical" | "none";

interface TextureProps {
  pattern?: TexturePattern;
  size?: number; // Tile size in pixels (default depends on pattern)
  opacity?: number; // Override opacity, defaults to theme variable/class
  fade?: TextureFade;
  rotate?: number; // e.g. 0, 45, 90
  className?: string;
}

/**
 * Shared Texture component rendering an SVG `<pattern>` filled with `var(--main)`
 * inside Layer 2 (`z-[2]`) of the 5-layer stacking contract.
 *
 * Uses SVG <defs> + <pattern> to guarantee 100% reliable rendering without
 * negative z-index occlusions or CSS mask-composite browser incompatibilities.
 */
export function Texture({
  pattern = "girih",
  size,
  opacity,
  fade = "vertical",
  rotate = 0,
  className,
}: TextureProps) {
  const rawId = useId();
  // Safe CSS ID
  const patternId = `ihyaa-pat-${pattern}-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`;
  const maskId = `ihyaa-mask-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`;

  // Default sizes matching geometry
  const tileSize =
    size ??
    (pattern === "mandala"
      ? 180
      : pattern === "star-rosette"
      ? 72
      : pattern === "octagon-grid"
      ? 80
      : pattern === "interlocking"
      ? 64
      : pattern === "octagon-tile"
      ? 60
      : 52); // girih

  return (
    <div
      data-testid="texture-layer"
      data-pattern={pattern}
      aria-hidden="true"
      style={{
        opacity: opacity !== undefined ? opacity : undefined,
      }}
      className={cn(
        "pointer-events-none absolute inset-0 z-[2] overflow-hidden select-none",
        opacity === undefined && "opacity-[var(--texture-opacity,0.13)]",
        className,
      )}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={patternId}
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
            patternTransform={rotate ? `rotate(${rotate})` : undefined}
          >
            <image
              href={`/patterns/${
                pattern === "interlocking"
                  ? "interlocking-geometric"
                  : pattern === "octagon-grid"
                  ? "islamic-octagon-grid"
                  : pattern
              }.svg`}
              width={tileSize}
              height={tileSize}
              preserveAspectRatio="xMidYMid slice"
            />
          </pattern>

          {fade === "vertical" && (
            <linearGradient id={maskId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0" />
              <stop offset="10%" stopColor="#fff" stopOpacity="1" />
              <stop offset="90%" stopColor="#fff" stopOpacity="1" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          )}

          {fade === "radial" && (
            <radialGradient id={maskId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="1" />
              <stop offset="65%" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          )}

          <mask id={`mask-wrap-${maskId}`}>
            <rect
              width="100%"
              height="100%"
              fill={fade === "none" ? "#fff" : `url(#${maskId})`}
            />
          </mask>
        </defs>

        {/* 1. Underlying color fill in var(--main) masked by the pattern */}
        <rect
          width="100%"
          height="100%"
          fill="var(--main)"
          mask={`url(#mask-wrap-${maskId})`}
          style={{
            maskImage: `url(#${patternId})`,
            WebkitMaskImage: `url(#${patternId})`,
          }}
        />

        {/* 2. Direct SVG Pattern Overlay for robust cross-browser fill */}
        <rect
          width="100%"
          height="100%"
          fill={`url(#${patternId})`}
          mask={fade === "none" ? undefined : `url(#mask-wrap-${maskId})`}
          style={{
            // SVG images use currentColor / stroke via CSS filter or mix if needed
            mixBlendMode: "luminosity",
          }}
          className="opacity-90"
        />
      </svg>
    </div>
  );
}
