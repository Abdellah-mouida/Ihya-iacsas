"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { CARD_POSTERS } from "@/lib/content";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const GAP = 26; // px between posters
const AUTOPLAY_MS = 4500;
const TRANSITION = { duration: 0.7, ease: EASE };

/**
 * Card poster carousel — a center-mode, infinitely looping showcase.
 *
 * Design goals (all met here):
 *  - auto-advancing loop with smooth expo easing
 *  - a peek of the adjacent posters on either side (center mode)
 *  - pause on hover / focus / while dragging
 *  - swipe support on touch + pointer devices (RTL aware)
 *  - each card treated as a poster with depth, gold inner frame + shadow
 *
 * Looping is seamless via a clone-padded track (2 clones each side) so the
 * neighbours always exist even at the wrap point; when a clone reaches centre
 * we snap (un-animated) back onto the matching real slide.
 */
export function CardCarousel() {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();

  const items = CARD_POSTERS;
  const n = items.length;

  // Clone-padded track: [last-1, last, ...reals, first, first+1]. Access via a
  // modular helper so clone construction is safe for ANY list length (a short
  // list no longer yields `undefined` src values, which previously corrupted
  // the loop). Ordering is unchanged for the normal (>=2 item) case.
  const extended = useMemo(() => {
    if (n === 0) return [];
    const at = (idx: number) => items[((idx % n) + n) % n];
    return [at(n - 2), at(n - 1), ...items, at(0), at(1)];
  }, [items, n]);
  const REAL_START = 2; // reals occupy indices 2 .. n+1

  const viewportRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ vpW: 0, slideW: 300, slideH: 375 });
  const [pos, setPos] = useState(REAL_START);
  const [animate, setAnimate] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);

  const paused = hovering || dragging;

  // Responsive sizing: posters are narrower than the viewport so neighbours peek.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const vpW = el.clientWidth;
      const slideW = Math.round(Math.min(Math.max(vpW * 0.66, 230), 360));
      const slideH = Math.round((slideW * 5) / 4); // 4:5 poster ratio
      setDims({ vpW, slideW, slideH });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = dims.slideW + GAP;
  const x = dims.vpW / 2 - dims.slideW / 2 - pos * step;

  const go = useCallback((delta: number) => {
    setAnimate(true);
    setPos((p) => p + delta);
  }, []);

  // Re-enable animation on the frame after an un-animated snap.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  // After a transition into a clone, jump (un-animated) to the matching real.
  const handleComplete = useCallback(() => {
    if (pos > n + 1) {
      setAnimate(false);
      setPos((p) => p - n);
    } else if (pos < REAL_START) {
      setAnimate(false);
      setPos((p) => p + n);
    }
  }, [pos, n]);

  // Autoplay (respects reduced-motion + pause states).
  useEffect(() => {
    if (paused || reduceMotion || dims.vpW === 0) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, dims.vpW, go]);

  // ---- Swipe / drag (pointer + touch) ----
  const start = useRef<{ x: number; y: number } | null>(null);
  const didSwipe = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    start.current = { x: e.clientX, y: e.clientY };
    didSwipe.current = false;
    setDragging(true);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (!didSwipe.current && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true;
    }
  }
  function endPointer(e: ReactPointerEvent) {
    if (start.current && didSwipe.current) {
      const dx = e.clientX - start.current.x;
      // The track is laid out LTR (see below), so dragging left always advances.
      go(dx < 0 ? 1 : -1);
    }
    start.current = null;
    setDragging(false);
  }

  const realIndex = ((pos - REAL_START) % n + n) % n;

  return (
    <section id="cards" className="relative overflow-hidden py-24 sm:py-32">
      {/* Soft brand glow behind the stage */}
      <div
        aria-hidden
        className="bg-spirit-gradient absolute inset-x-0 top-1/2 -z-10 h-[26rem] -translate-y-1/2 opacity-[0.06] blur-3xl"
      />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("cards.kicker")}
          title={t("cards.title")}
          desc={t("cards.desc")}
        />

        <div
          className="group relative mt-14"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onFocusCapture={() => setHovering(true)}
          onBlurCapture={() => setHovering(false)}
        >
          {/* Stage — forced LTR so the translate math is direction-agnostic
              (the site is RTL by default; an RTL flex track would lay slides
              out right-to-left and invert the loop direction + mis-center). */}
          <div
            ref={viewportRef}
            dir="ltr"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={(e) => start.current && endPointer(e)}
            className="relative mx-auto w-full max-w-3xl touch-pan-y select-none overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [perspective:1400px]"
            style={{ height: dims.slideH }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 flex items-center"
              style={{ gap: GAP }}
              animate={{ x }}
              transition={animate ? TRANSITION : { duration: 0 }}
              onAnimationComplete={handleComplete}
            >
              {extended.map((item, i) => {
                const isCenter = i === pos;
                const side = i - pos; // <0 left, >0 right
                return (
                  <motion.figure
                    key={`${item.src}-${i}`}
                    className="relative shrink-0"
                    style={{ width: dims.slideW, height: dims.slideH }}
                    animate={{
                      scale: isCenter ? 1 : 0.86,
                      opacity: isCenter ? 1 : 0.5,
                      rotateY: reduceMotion ? 0 : isCenter ? 0 : side < 0 ? 9 : -9,
                    }}
                    transition={animate ? TRANSITION : { duration: 0 }}
                  >
                    <div
                      className={cn(
                        "relative h-full w-full overflow-hidden rounded-[1.75rem] shadow-layered ring-1 transition-shadow duration-500",
                        isCenter
                          ? "ring-brass/45 glow-gold"
                          : "ring-border/60",
                      )}
                    >
                      <Image
                        src={item.src}
                        alt={t(item.altKey)}
                        fill
                        draggable={false}
                        loading="eager"
                        sizes="(max-width: 640px) 66vw, 360px"
                        className="object-cover"
                      />
                      {/* Warm overlay + gold inner frame (poster treatment) */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/45 via-transparent to-transparent" />
                      <div className="pointer-events-none absolute inset-2.5 rounded-[1.4rem] ring-1 ring-inset ring-gold/35" />
                    </div>
                  </motion.figure>
                );
              })}
            </motion.div>
          </div>

          {/* Controls */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("cards.prev")}
            className="glass-strong absolute top-1/2 start-1 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground shadow-layered transition hover:scale-110 hover:text-brass sm:start-3"
          >
            <ChevronLeft className="size-5 rtl:hidden" />
            <ChevronRight className="hidden size-5 rtl:block" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("cards.next")}
            className="glass-strong absolute top-1/2 end-1 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full text-foreground shadow-layered transition hover:scale-110 hover:text-brass sm:end-3"
          >
            <ChevronRight className="size-5 rtl:hidden" />
            <ChevronLeft className="hidden size-5 rtl:block" />
          </button>

          {/* Dots */}
          <div className="mt-8 flex items-center justify-center gap-2.5">
            {items.map((item, i) => {
              const active = i === realIndex;
              return (
                <button
                  key={item.src}
                  type="button"
                  onClick={() => {
                    setAnimate(true);
                    setPos(REAL_START + i);
                  }}
                  aria-label={t("cards.goTo", { n: i + 1 })}
                  aria-current={active}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    active
                      ? "bg-brass-gradient w-7"
                      : "w-2 bg-muted-foreground/35 hover:bg-brass/60",
                  )}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
