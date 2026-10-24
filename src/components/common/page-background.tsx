import { cn } from "@/lib/utils";
import { PageTexture } from "./page-texture";

interface PageBackgroundProps {
  variant?: "default" | "auth" | "profile" | "content" | "admin";
  className?: string;
  children?: React.ReactNode;
  showOrnaments?: boolean;
}

/**
 * Shared PageBackground component providing a solid Layer 0 background,
 * Layer 1 glows, Layer 2 single continuous PageTexture with `var(--main)` tinting,
 * and Layer 4 interactive children, strictly obeying the 5-layer stacking contract.
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
        "relative isolate min-h-screen w-full overflow-hidden bg-background text-foreground z-0",
        className,
      )}
    >
      {/* Layer 1: Ambient Glows & Mesh Gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      >
        <div
          className={cn(
            "absolute -top-[15%] start-[10%] h-[55vw] max-h-[600px] w-[55vw] max-w-[600px] rounded-full blur-[110px] transition-all duration-700",
            variant === "auth" &&
              "opacity-75 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]",
            variant === "profile" &&
              "opacity-80 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_65%)]",
            variant === "admin" &&
              "opacity-50 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_14%,transparent),transparent_70%)]",
            variant === "content" &&
              "opacity-60 bg-[radial-gradient(circle,color-mix(in_oklch,var(--emerald)_16%,transparent),transparent_70%)]",
            variant === "default" &&
              "opacity-60 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_15%,transparent),transparent_70%)]",
          )}
        />
        <div
          className={cn(
            "absolute top-[45%] end-[5%] h-[50vw] max-h-[550px] w-[50vw] max-w-[550px] rounded-full blur-[120px] transition-all duration-700",
            variant === "auth" &&
              "opacity-65 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_16%,transparent),transparent_70%)]",
            variant === "profile" &&
              "opacity-75 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_20%,transparent),transparent_70%)]",
            variant === "admin" &&
              "opacity-45 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_15%,transparent),transparent_70%)]",
            variant === "content" &&
              "opacity-55 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_15%,transparent),transparent_70%)]",
            variant === "default" &&
              "opacity-55 bg-[radial-gradient(circle,color-mix(in_oklch,var(--emerald)_16%,transparent),transparent_70%)]",
          )}
        />
        <div
          className={cn(
            "absolute -bottom-[10%] start-[25%] h-[40vw] max-h-[450px] w-[40vw] max-w-[450px] rounded-full blur-[130px] opacity-40 bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]",
          )}
        />
      </div>

      {/* Layer 2: Single continuous page-wide texture */}
      <PageTexture />

      {/* Layer 3: Subtle Corner Ornaments */}
      {showOrnaments && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] overflow-hidden select-none"
        >
          {/* Top-Right Corner Ornament */}
          <div className="absolute -top-6 -end-6 h-40 w-40 opacity-[0.09] dark:opacity-[0.14] transition-opacity duration-500 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-br from-primary via-brass to-transparent rtl:-scale-x-100" />

          {/* Bottom-Left Corner Ornament */}
          <div className="absolute -bottom-6 -start-6 h-40 w-40 opacity-[0.08] dark:opacity-[0.13] transition-opacity duration-500 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-tl from-primary via-brass to-transparent rotate-180 rtl:scale-x-100" />
        </div>
      )}

      {/* Layer 4: Main Interactive Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
