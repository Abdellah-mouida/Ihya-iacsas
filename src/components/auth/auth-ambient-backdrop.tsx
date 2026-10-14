export function AuthAmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-testid="auth-ambient-backdrop"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Primary ambient glowing orb - Brand green top corner */}
      <div className="absolute -top-32 -start-32 size-[460px] rounded-full bg-primary/15 blur-[120px] dark:bg-primary/20" />

      {/* Secondary ambient glowing orb - Brass/Gold bottom corner */}
      <div className="absolute -bottom-40 -end-40 size-[500px] rounded-full bg-brass/10 blur-[140px] dark:bg-brass/15" />

      {/* Center subtle fill illumination */}
      <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-[650px] rounded-full bg-emerald-500/5 blur-[150px] dark:bg-emerald-500/10" />

      {/* Subtle Islamic Girih geometric pattern watermark */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage: "url('/patterns/girih.svg')",
          backgroundSize: "320px 320px",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Subtle radial vignette to soften edges */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_90%)]" />
    </div>
  );
}
