"use client";

import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { IslamicLoader } from "@/components/common/islamic-loader";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { FeaturedEvent } from "./featured-event";

type DisplayEvent = {
  id: string;
  slug?: string;
  titleAr?: string;
  titleEn?: string;
  titleKey?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  date?: Date | string;
  dateKey?: string;
  time?: string;
  timeKey?: string;
  location?: string;
  locationKey?: string;
  posterUrl?: string;
  poster?: string;
  capacityType?: string;
  capacity?: number | null;
  confirmedCount?: number;
  isFull?: boolean;
};

export function OpenEvents() {
  const { t, dir } = useLocale();
  const [openEvents, setOpenEvents] = useState<DisplayEvent[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ignore = false;
    getPublicEvents().then((res) => {
      if (ignore) return;
      if (res.success && res.openEvents) {
        setOpenEvents(res.openEvents as unknown as DisplayEvent[]);
      } else {
        setOpenEvents([]);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  // Listen for prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mq.addEventListener?.("change", handler);
    return () => {
      mq.removeEventListener?.("change", handler);
    };
  }, []);

  const scrollToEvent = useCallback((index: number) => {
    setActiveIndex(index);
    const targetSlide = slideRefs.current[index];
    if (targetSlide) {
      targetSlide.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, []);

  // Update activeIndex using IntersectionObserver on slides
  useEffect(() => {
    if (!openEvents || openEvents.length <= 1) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = slideRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: trackRef.current,
        threshold: 0.5,
      },
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => observer.disconnect();
  }, [openEvents]);

  const advanceNext = useCallback(() => {
    if (!openEvents || openEvents.length <= 1) return;
    setActiveIndex((curr) => {
      const next = (curr + 1) % openEvents.length;
      const targetSlide = slideRefs.current[next];
      if (targetSlide) {
        targetSlide.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
      return next;
    });
  }, [openEvents]);

  const isPaused = isHovered || isFocused || isTouching || prefersReducedMotion;

  const resetAutoAdvanceTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!isPaused && openEvents && openEvents.length > 1) {
      timerRef.current = setInterval(() => {
        advanceNext();
      }, 5000);
    }
  }, [isPaused, openEvents, advanceNext]);

  useEffect(() => {
    resetAutoAdvanceTimer();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [resetAutoAdvanceTimer]);

  const handlePrev = useCallback(() => {
    if (!openEvents || openEvents.length <= 1) return;
    setActiveIndex((curr) => {
      const newIndex = (curr - 1 + openEvents.length) % openEvents.length;
      const targetSlide = slideRefs.current[newIndex];
      if (targetSlide) {
        targetSlide.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
      return newIndex;
    });
    resetAutoAdvanceTimer();
  }, [openEvents, resetAutoAdvanceTimer]);

  const handleNext = useCallback(() => {
    if (!openEvents || openEvents.length <= 1) return;
    setActiveIndex((curr) => {
      const newIndex = (curr + 1) % openEvents.length;
      const targetSlide = slideRefs.current[newIndex];
      if (targetSlide) {
        targetSlide.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
      return newIndex;
    });
    resetAutoAdvanceTimer();
  }, [openEvents, resetAutoAdvanceTimer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        if (dir === "rtl") {
          handleNext();
        } else {
          handlePrev();
        }
      } else if (e.key === "ArrowRight") {
        if (dir === "rtl") {
          handlePrev();
        } else {
          handleNext();
        }
      }
    },
    [dir, handleNext, handlePrev],
  );

  if (openEvents === null) {
    return (
      <div
        data-testid="events-loading"
        className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center py-20 min-h-[380px]"
      >
        <div className="glass relative flex w-full max-w-md flex-col items-center justify-center rounded-3xl p-10 ring-1 ring-border/60 shadow-layered">
          <IslamicLoader size="lg" message={t("events.loading")} />
        </div>
      </div>
    );
  }

  if (openEvents.length === 0) {
    return (
      <div data-testid="no-open-events" className="mx-auto max-w-4xl px-5 py-16 text-center">
        <div className="glass relative mx-auto flex flex-col items-center justify-center rounded-3xl p-10 ring-1 ring-border/60 shadow-layered">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brass/10 text-brass ring-1 ring-brass/25 mb-4">
            <CalendarClock className="size-7" />
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground sm:text-2xl">
            {t("events.noneTitle")}
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("events.noneDesc")}
          </p>
        </div>
      </div>
    );
  }

  const activeEvents = openEvents;

  // Single event view: render without carousel controls or timer
  if (activeEvents.length === 1) {
    return <FeaturedEvent event={activeEvents[0]} isFirst={true} />;
  }

  // Multiple events view: render carousel with centered arrows & indicators underneath
  return (
    <div
      className="relative w-full"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
        }
      }}
      onTouchStart={() => setIsTouching(true)}
      onTouchEnd={() => {
        setIsTouching(false);
        resetAutoAdvanceTimer();
      }}
    >
      {/* Carousel Track */}
      <div
        ref={trackRef}
        data-testid="open-events-carousel"
        tabIndex={0}
        aria-label={t("events.title")}
        className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth focus:outline-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {activeEvents.map((ev, idx) => (
          <div
            key={ev.id}
            ref={(el) => {
              slideRefs.current[idx] = el;
            }}
            className="w-full shrink-0 snap-center snap-always min-w-full"
          >
            <FeaturedEvent event={ev} isFirst={idx === 0} />
          </div>
        ))}
      </div>

      {/* Centered Controls under the carousel */}
      <div
        data-testid="carousel-controls"
        className="mx-auto flex items-center justify-center gap-4 pt-4 pb-8"
      >
        {/* Previous Arrow Button */}
        <button
          type="button"
          onClick={handlePrev}
          data-testid="carousel-prev-btn"
          aria-label={t("events.carouselPrev")}
          className="flex size-11 sm:size-12 items-center justify-center rounded-full bg-card/70 backdrop-blur-md border border-brass/25 text-foreground transition-all duration-200 hover:border-brass/70 hover:text-brass hover:bg-brass/10 hover:scale-105 active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          {dir === "rtl" ? (
            <ChevronRight className="size-5 sm:size-6" />
          ) : (
            <ChevronLeft className="size-5 sm:size-6" />
          )}
        </button>

        {/* Slide indicator dots */}
        <div
          className="flex items-center justify-center gap-2 px-2"
          role="tablist"
          aria-label="Slides"
        >
          {activeEvents.map((ev, idx) => (
            <button
              key={ev.id}
              type="button"
              role="tab"
              aria-selected={activeIndex === idx}
              aria-label={`Slide ${idx + 1}`}
              data-testid={`carousel-dot-${idx}`}
              onClick={() => {
                scrollToEvent(idx);
                resetAutoAdvanceTimer();
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                activeIndex === idx
                  ? "w-7 bg-brass shadow-sm"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>

        {/* Next Arrow Button */}
        <button
          type="button"
          onClick={handleNext}
          data-testid="carousel-next-btn"
          aria-label={t("events.carouselNext")}
          className="flex size-11 sm:size-12 items-center justify-center rounded-full bg-card/70 backdrop-blur-md border border-brass/25 text-foreground transition-all duration-200 hover:border-brass/70 hover:text-brass hover:bg-brass/10 hover:scale-105 active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
        >
          {dir === "rtl" ? (
            <ChevronLeft className="size-5 sm:size-6" />
          ) : (
            <ChevronRight className="size-5 sm:size-6" />
          )}
        </button>
      </div>
    </div>
  );
}
