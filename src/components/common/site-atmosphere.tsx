/** Static, site-wide atmospheric layers. The root layout mounts this once. */
export function SiteAtmosphere() {
  return (
    <div
      aria-hidden="true"
      data-testid="site-atmosphere"
      className="site-atmosphere pointer-events-none fixed inset-0 z-0 isolate overflow-hidden"
    >
      <div className="absolute inset-0 z-0 bg-background" />
      <div className="site-atmosphere-glow site-atmosphere-glow-start absolute z-[1]" />
      <div className="site-atmosphere-glow site-atmosphere-glow-end absolute z-[1]" />
      <svg
        data-testid="site-atmosphere-pattern"
        className="site-atmosphere-pattern absolute inset-0 z-[2] size-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern id="site-khatam-pattern" width="120" height="120" viewBox="0 0 100 100" patternUnits="userSpaceOnUse">
            <path d="M50 6 61 30 86 20 76 45 94 50 76 55 86 80 61 70 50 94 39 70 14 80 24 55 6 50 24 45 14 20 39 30Z" fill="none" stroke="currentColor" strokeWidth=".8" />
            <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth=".8" />
          </pattern>
          <radialGradient id="site-pattern-fade">
            <stop offset="30%" stopColor="white" stopOpacity="1" />
            <stop className="site-pattern-edge-mid" offset="78%" stopColor="white" />
            <stop className="site-pattern-edge" offset="100%" stopColor="white" />
          </radialGradient>
          <mask id="site-pattern-mask">
            <rect width="100%" height="100%" fill="url(#site-pattern-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#site-khatam-pattern)" mask="url(#site-pattern-mask)" />
      </svg>
      <div className="site-atmosphere-vignette absolute inset-0 z-[3]" />
    </div>
  );
}
