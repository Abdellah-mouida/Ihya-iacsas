"use client";

import { useCallback, useState, type KeyboardEvent } from "react";

import { SmoothImage } from "@/components/common/smooth-image";
import "./MorphSlider.css";

export type SliderItem = {
  image: string;
  alt?: string;
  caption?: string;
  date?: string;
};

export type SliderLabels = {
  sliderLabel: string;
  slidesLabel: string;
  previousSlide: string;
  nextSlide: string;
  goToSlide: string;
};

const DEFAULT_LABELS: SliderLabels = {
  sliderLabel: "Gallery slider",
  slidesLabel: "Slides",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  goToSlide: "Go to slide {n}",
};

/** Lightweight crossfade slider used on low-power, reduced-motion, and WebGL-fallback paths. */
export function MorphCrossfade({
  items,
  startIndex = 0,
  duration = 0.45,
  loop = true,
  showCaptions = true,
  showControls = true,
  showIndicators = true,
  dir = "ltr",
  labels = DEFAULT_LABELS,
  reducedMotion = false,
  className = "",
}: {
  items: SliderItem[];
  startIndex?: number;
  duration?: number;
  loop?: boolean;
  showCaptions?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  dir?: string;
  labels?: SliderLabels;
  reducedMotion?: boolean;
  className?: string;
}) {
  const [index, setIndex] = useState(startIndex);
  const safeIndex = items.length > 0 ? ((index % items.length) + items.length) % items.length : 0;
  const isRtl = dir === "rtl";

  const step = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      setIndex((prev) => {
        const raw = prev + delta;
        if (!loop) return Math.max(0, Math.min(items.length - 1, raw));
        return (raw + items.length) % items.length;
      });
    },
    [items.length, loop],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(isRtl ? -1 : 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(isRtl ? 1 : -1);
      }
    },
    [isRtl, step],
  );

  const hasCaptions = items.some((item) => item.caption);

  return (
    <div
      data-rb="MorphSlider"
      data-morph-mode="crossfade"
      data-morph-rendering="false"
      className={`morph-slider ${className}`.trim()}
      style={
        {
          "--ms-swap": `${(Math.min(duration, 0.45) * 0.66).toFixed(3)}s`,
          "--ms-dot": `${(Math.min(duration, 0.45) * 0.45).toFixed(3)}s`,
        } as React.CSSProperties
      }
    >
      <div
        className="morph-slider-stage"
        data-static="true"
        role="group"
        aria-roledescription="carousel"
        aria-label={labels.sliderLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <div className="morph-slider-fallback">
          {items.map((item, i) => (
            <div
              key={`${item.image}-${i}`}
              aria-hidden={i === safeIndex ? undefined : true}
              className={`morph-slider-fallback-slide ${i === safeIndex ? "is-active" : ""}`}
            >
              <SmoothImage
                src={item.image}
                alt={item.alt || item.caption || ""}
                fill
                sizes="(max-width: 640px) 100vw, 1152px"
                className="object-cover"
                fadeDurationMs={reducedMotion ? 0 : 350}
              />
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="morph-slider-vignette" />

      {showCaptions && hasCaptions && (
        <div className="morph-slider-caption" aria-live="polite">
          {items.map((item, i) =>
            item.caption ? (
              <span
                key={`${item.caption}-${i}`}
                aria-hidden={i === safeIndex ? undefined : true}
                className={`morph-slider-caption-text ${i === safeIndex ? "is-active" : ""}`}
              >
                <span className="morph-slider-caption-main">{item.caption}</span>
                {item.date ? <time className="morph-slider-caption-date">{item.date}</time> : null}
              </span>
            ) : null,
          )}
        </div>
      )}

      {showControls && items.length > 1 && (
        <div className="morph-slider-controls">
          <button
            type="button"
            className="morph-slider-btn"
            aria-label={labels.previousSlide}
            onClick={() => step(-1)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="rtl:rotate-180">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="morph-slider-btn"
            aria-label={labels.nextSlide}
            onClick={() => step(1)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="rtl:rotate-180">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {showIndicators && items.length > 1 && (
        <div className="morph-slider-indicators" role="tablist" aria-label={labels.slidesLabel}>
          {items.map((item, i) => (
            <button
              key={`${item.image}-dot-${i}`}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={labels.goToSlide.replace("{n}", String(i + 1))}
              className={`morph-slider-dot ${i === safeIndex ? "is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
