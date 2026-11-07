"use client";

import { useEffect, useRef } from "react";

/** The only interactive part of the shared site background. */
export function SitePointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrowViewport = window.matchMedia("(max-width: 639px)");

    let frame = 0;
    let x = 0;
    let y = 0;
    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      element.dataset.active = "true";
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        });
      }
    };
    const leave = () => { element.dataset.active = "false"; };
    let listening = false;
    const stop = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      leave();
    };
    const sync = () => {
      const canTrack = finePointer.matches && !narrowViewport.matches && !reducedMotion.matches;
      if (canTrack && !listening) {
        listening = true;
        window.addEventListener("pointermove", move, { passive: true });
        document.documentElement.addEventListener("pointerleave", leave);
      } else if (!canTrack) {
        stop();
      }
    };
    sync();
    finePointer.addEventListener("change", sync);
    narrowViewport.addEventListener("change", sync);
    reducedMotion.addEventListener("change", sync);
    return () => {
      stop();
      finePointer.removeEventListener("change", sync);
      narrowViewport.removeEventListener("change", sync);
      reducedMotion.removeEventListener("change", sync);
    };
  }, []);

  return <div ref={ref} className="site-pointer-glow fixed start-0 top-0 z-[3]" aria-hidden="true" />;
}
