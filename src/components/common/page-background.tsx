import { cn } from "@/lib/utils";

interface PageBackgroundProps {
  variant?: "default" | "auth" | "profile" | "content" | "admin";
  className?: string;
  children?: React.ReactNode;
  showOrnaments?: boolean;
}

/**
 * Shared PageBackground component for full surface texture and Islamic geometric motifs.
 * Uses CSS mask-image with SVG patterns so the texture reacts dynamically to theme tokens.
 */
export function PageBackground({
  variant = "default",
  className,
  children,
  showOrnaments = true,
}: PageBackgroundProps) {
  return (
    <div
      data-testid="page-background"
      data-variant={variant}
      className={cn(
        "relative min-h-screen w-full overflow-hidden bg-background text-foreground",
        className,
      )}
    >
      {/* 1. Base Ambient Glows & Radial Mesh */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-30 overflow-hidden"
      >
        <div
          className={cn(
            "absolute -top-[15%] start-[10%] h-[55vw] max-h-[600px] w-[55vw] max-w-[600px] rounded-full blur-[110px] transition-all duration-700",
            variant === "auth" && "opacity-75 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]",
            variant === "profile" && "opacity-80 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_65%)]",
            variant === "admin" && "opacity-50 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_14%,transparent),transparent_70%)]",
            variant === "content" && "opacity-60 bg-[radial-gradient(circle,color-mix(in_oklch,var(--emerald)_16%,transparent),transparent_70%)]",
            variant === "default" && "opacity-60 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_15%,transparent),transparent_70%)]",
          )}
        />
        <div
          className={cn(
            "absolute top-[45%] end-[5%] h-[50vw] max-h-[550px] w-[50vw] max-w-[550px] rounded-full blur-[120px] transition-all duration-700",
            variant === "auth" && "opacity-65 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_16%,transparent),transparent_70%)]",
            variant === "profile" && "opacity-75 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_20%,transparent),transparent_70%)]",
            variant === "admin" && "opacity-45 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_70%)]",
            variant === "content" && "opacity-55 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_15%,transparent),transparent_70%)]",
            variant === "default" && "opacity-55 bg-[radial-gradient(circle,color-mix(in_oklch,var(--emerald)_16%,transparent),transparent_70%)]",
          )}
        />
        <div
          className={cn(
            "absolute -bottom-[10%] start-[25%] h-[40vw] max-h-[450px] w-[40vw] max-w-[450px] rounded-full blur-[130px] opacity-40 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]",
          )}
        />
      </div>

      {/* 2. Primary Islamic Geometric Texture Layer via CSS Mask */}
      <div
        data-testid="page-texture-layer"
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-20",
          variant === "auth" && "page-texture-auth",
          variant === "profile" && "page-texture-profile",
          variant === "content" && "page-texture-content",
          variant === "admin" && "page-texture-admin",
          variant === "default" && "page-texture-default",
        )}
      />

      {/* 3. Subtle Corner Ornaments & Mandala Watermark */}
      {showOrnaments && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
        >
          {/* Top-Right Corner Ornament */}
          <div
            className="absolute -top-6 -end-6 h-40 w-40 opacity-[0.09] dark:opacity-[0.14] transition-opacity duration-500 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-br from-primary via-brass to-transparent rtl:-scale-x-100"
          />

          {/* Bottom-Left Corner Ornament */}
          <div
            className="absolute -bottom-6 -start-6 h-40 w-40 opacity-[0.08] dark:opacity-[0.13] transition-opacity duration-500 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-tl from-primary via-brass to-transparent rotate-180 rtl:scale-x-100"
          />

          {/* Center-Floating Subtle Mandala watermark on auth/profile */}
          {(variant === "auth" || variant === "profile") && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] opacity-[0.04] dark:opacity-[0.07] pointer-events-none [mask-image:url(/patterns/mandala.svg)] [mask-size:contain] [mask-position:center] [mask-repeat:no-repeat] bg-gradient-to-tr from-primary via-brass to-transparent animate-spin-slow"
            />
          )}
        </div>
      )}

      {/* Main Content Render */}
      {children}
    </div>
  );
}
