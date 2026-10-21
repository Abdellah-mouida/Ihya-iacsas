export function AuthAmbientBackdrop({ pattern = "octagon-tile" }: { pattern?: "octagon-tile" | "interlocking" | "girih" }) {
  return (
    <div
      aria-hidden="true"
      data-testid="auth-ambient-backdrop"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Primary ambient glowing orb - Brand green top corner */}
      <div className="absolute -top-32 -start-32 size-[460px] rounded-full bg-primary/20 blur-[120px] dark:bg-primary/25" />

      {/* Secondary ambient glowing orb - Brass/Gold bottom corner */}
      <div className="absolute -bottom-40 -end-40 size-[500px] rounded-full bg-brass/15 blur-[140px] dark:bg-brass/20" />

      {/* Center subtle fill illumination */}
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-[650px] rounded-full bg-emerald/10 blur-[150px] dark:bg-emerald/15" />

      {/* High-fidelity CSS Mask-Image Geometric Pattern (Theme Reactive) */}
      <div
        className={`texture-surface ${
          pattern === "octagon-tile"
            ? "texture-octagon-tile"
            : pattern === "interlocking"
              ? "texture-interlocking"
              : "texture-girih"
        } absolute inset-0 pointer-events-none`}
      />

      {/* Corner Ornaments */}
      <div className="absolute -top-6 -end-6 h-36 w-36 opacity-10 dark:opacity-15 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-br from-primary via-brass to-transparent rtl:-scale-x-100" />
      <div className="absolute -bottom-6 -start-6 h-36 w-36 opacity-10 dark:opacity-15 [mask-image:url(/patterns/corner-ornament.svg)] [mask-size:contain] [mask-repeat:no-repeat] bg-gradient-to-tl from-primary via-brass to-transparent rotate-180 rtl:scale-x-100" />

      {/* Subtle radial vignette to soften edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_90%)]" />
    </div>
  );
}
