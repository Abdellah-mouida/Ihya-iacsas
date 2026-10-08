"use client";

import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { useLocale } from "@/i18n/locale-provider";
import { useIsEventBooked } from "@/lib/booking-state";
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

function EventTabButton({
  event,
  index,
  isActive,
  onClick,
}: {
  event: DisplayEvent;
  index: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t, locale } = useLocale();
  const isBooked = useIsEventBooked(event.id);
  const title = event.titleKey
    ? t(event.titleKey)
    : locale === "ar"
      ? event.titleAr || ""
      : event.titleEn || "";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-testid={`event-tab-${event.id}`}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all duration-300",
        isActive
          ? "bg-brass/20 text-brass ring-1 ring-brass/50 shadow-sm"
          : "glass text-muted-foreground hover:text-foreground hover:bg-card/60",
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[10px] font-bold font-mono transition-colors",
          isActive
            ? "bg-brass text-night"
            : "bg-muted text-muted-foreground group-hover:bg-foreground/10 group-hover:text-foreground",
        )}
      >
        0{index + 1}
      </span>
      <span className="max-w-[140px] sm:max-w-[200px] truncate">{title}</span>
      {isBooked && (
        <span
          title="حجزك مؤكد"
          className="flex size-4 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="size-3" />
        </span>
      )}
    </button>
  );
}

export function OpenEvents() {
  const { t, dir } = useLocale();
  const [openEvents, setOpenEvents] = useState<DisplayEvent[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  if (openEvents === null) {
    return null;
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

  const handlePrev = () => {
    if (activeEvents.length <= 1) return;
    const newIndex = (activeIndex - 1 + activeEvents.length) % activeEvents.length;
    scrollToEvent(newIndex);
  };

  const handleNext = () => {
    if (activeEvents.length <= 1) return;
    const newIndex = (activeIndex + 1) % activeEvents.length;
    scrollToEvent(newIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
  };

  if (activeEvents.length === 0) {
    return (
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-5">
          <div className="glass-strong flex flex-col items-center gap-4 rounded-3xl p-10 text-center shadow-layered">
            <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25">
              <CalendarClock className="size-7" />
            </span>
            <h2 className="font-heading text-2xl font-semibold">
              {t("events.noneTitle")}
            </h2>
            <p className="max-w-md text-muted-foreground">
              {t("events.noneDesc")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Single event view: render without carousel switcher controls
  if (activeEvents.length === 1) {
    return <FeaturedEvent event={activeEvents[0]} isFirst={true} />;
  }

  // Multiple events view: render carousel with interactive switcher
  return (
    <div className="relative w-full" onKeyDown={handleKeyDown}>
      {/* Switcher Control Bar */}
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:pt-12">
        <div
          data-testid="event-switcher"
          className="glass-strong flex flex-col gap-4 rounded-3xl p-4 sm:p-5 shadow-layered border border-brass/20"
        >
          {/* Top header: Kicker badge, counter, and navigation arrows */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brass/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brass">
                <Sparkles className="size-3" />
                {t("events.switcherKicker")}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {t("events.switcherCounter")
                  .replace("{current}", String(activeIndex + 1))
                  .replace("{total}", String(activeEvents.length))}
              </span>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                data-testid="carousel-prev-btn"
                aria-label={t("events.switcherPrev")}
                className="flex size-9 items-center justify-center rounded-full glass border border-border/40 text-foreground transition-all hover:border-brass/40 hover:text-brass hover:scale-105 active:scale-95"
              >
                {dir === "rtl" ? (
                  <ChevronRight className="size-5" />
                ) : (
                  <ChevronLeft className="size-5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleNext}
                data-testid="carousel-next-btn"
                aria-label={t("events.switcherNext")}
                className="flex size-9 items-center justify-center rounded-full glass border border-border/40 text-foreground transition-all hover:border-brass/40 hover:text-brass hover:scale-105 active:scale-95"
              >
                {dir === "rtl" ? (
                  <ChevronLeft className="size-5" />
                ) : (
                  <ChevronRight className="size-5" />
                )}
              </button>
            </div>
          </div>

          {/* Interactive Event Tabs */}
          <div
            role="tablist"
            className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar"
            style={{ scrollbarWidth: "none" }}
          >
            {activeEvents.map((ev, idx) => (
              <EventTabButton
                key={ev.id}
                event={ev}
                index={idx}
                isActive={activeIndex === idx}
                onClick={() => scrollToEvent(idx)}
              />
            ))}
          </div>

          {/* Indicator dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {activeEvents.map((ev, idx) => (
              <button
                key={ev.id}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                onClick={() => scrollToEvent(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  activeIndex === idx
                    ? "w-6 bg-brass"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
              />
            ))}
          </div>
        </div>
      </div>

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
    </div>
  );
}
