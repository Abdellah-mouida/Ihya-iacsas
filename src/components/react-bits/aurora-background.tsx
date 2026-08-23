"use client";

import { cn } from "@/lib/utils";

/**
 * React Bits-style "Aurora" background — warm, premium, spiritual drifting
 * light blobs built with layered radial gradients (CSS/GPU, no WebGL) so it
 * stays lightweight above the fold. Colors pull from the brand palette.
 */
export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div className="animate-aurora absolute -top-1/4 left-[15%] size-[62vh] rounded-full bg-[radial-gradient(circle,var(--gold),transparent_60%)] opacity-45 blur-3xl" />
      <div className="animate-aurora absolute top-[20%] right-[12%] size-[56vh] rounded-full bg-[radial-gradient(circle,var(--emerald),transparent_60%)] opacity-30 blur-3xl [animation-delay:-6s]" />
      <div className="animate-aurora absolute bottom-[-10%] left-[30%] size-[52vh] rounded-full bg-[radial-gradient(circle,var(--brass),transparent_60%)] opacity-35 blur-3xl [animation-delay:-11s]" />
    </div>
  );
}
