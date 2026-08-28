"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * React Bits — "Waves" (Backgrounds category), hand-implemented following the
 * same canvas flowing-lines technique so it stays dependency-free and fully
 * tunable. Deliberately kept *ambient*: very low opacity/contrast and a slow
 * drift so it adds depth behind the post-hero sections without competing with
 * content or the section texture-fade.
 *
 * Renders as a fixed, viewport-sized layer (cheap to animate); the opaque hero
 * above and the opaque night sections naturally cover it where needed.
 */
export function WavesBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Half-resolution backing store — the softness hides it and keeps it light.
    const SCALE = 0.5;
    const state = { w: 0, h: 0, dark: false };

    const readTheme = () =>
      (state.dark = document.documentElement.classList.contains("dark"));

    const resize = () => {
      state.w = window.innerWidth;
      state.h = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(state.w * SCALE));
      canvas.height = Math.max(1, Math.floor(state.h * SCALE));
    };
    resize();
    readTheme();

    const SPACING = 34; // logical px between contour lines
    const AMP = 15;

    const draw = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const t = time * 0.001;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;

      // Warm brand tint with an occasional green line for cohesion.
      const gold = state.dark ? "233,196,106" : "150,110,40";
      const green = state.dark ? "90,180,120" : "40,110,60";
      const baseAlpha = state.dark ? 0.06 : 0.05;

      const spacing = SPACING * SCALE;
      const amp = AMP * SCALE;
      const lines = Math.ceil(h / spacing) + 2;
      const step = Math.max(6, Math.floor(18 * SCALE));

      for (let li = 0; li < lines; li++) {
        const baseY = li * spacing;
        const isGreen = li % 5 === 2;
        ctx.strokeStyle = `rgba(${isGreen ? green : gold},${
          isGreen ? baseAlpha * 0.9 : baseAlpha
        })`;
        ctx.beginPath();
        for (let x = -amp; x <= w + amp; x += step) {
          const y =
            baseY +
            Math.sin(x * 0.006 + t * 0.6 + li * 0.5) * amp +
            Math.sin(x * 0.014 - t * 0.9 + li * 0.9) * amp * 0.45;
          if (x === -amp) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      // ~30fps cap — plenty for a barely-there drift, and easier on the GPU.
      if (time - last > 33) {
        draw(time);
        last = time;
      }
      raf = requestAnimationFrame(loop);
    };

    if (reduce) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", resize, { passive: true });
    const themeObserver = new MutationObserver(readTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
