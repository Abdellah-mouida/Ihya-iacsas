"use client";

import { motion } from "framer-motion";
import { Calendar, CalendarClock, History, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type EventFilterType = "all" | "open" | "past";

interface EventsHeaderProps {
  filter?: EventFilterType;
  onFilterChange?: (filter: EventFilterType) => void;
  openCount?: number;
  pastCount?: number;
}

export function EventsHeader({
  filter = "all",
  onFilterChange,
  openCount: initialOpenCount,
  pastCount: initialPastCount,
}: EventsHeaderProps) {
  const { t } = useLocale();
  const [counts, setCounts] = useState<{ open: number; past: number }>({
    open: initialOpenCount ?? 0,
    past: initialPastCount ?? 0,
  });

  useEffect(() => {
    if (initialOpenCount !== undefined && initialPastCount !== undefined) {
      setCounts({ open: initialOpenCount, past: initialPastCount });
      return;
    }
    let ignore = false;
    getPublicEvents().then((res) => {
      if (!ignore && res.success) {
        setCounts({
          open: res.openEvents?.length || 0,
          past: res.pastEvents?.length || 0,
        });
      }
    });
    return () => {
      ignore = true;
    };
  }, [initialOpenCount, initialPastCount]);

  const totalCount = counts.open + counts.past;

  return (
    <section className="relative overflow-x-clip pt-36 pb-6 sm:pt-40">
      {/* Ambient brass glow to anchor the page header */}
      <div
        aria-hidden
        className="bg-brass-gradient absolute left-1/2 top-24 -z-10 size-72 max-w-[80vw] -translate-x-1/2 rounded-full opacity-[0.14] blur-3xl"
      />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("events.kicker")}
          title={t("events.title")}
          desc={t("events.desc")}
        />

        {/* Count Badges & Filter Bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="filter-all-events-btn"
            onClick={() => onFilterChange?.("all")}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 shadow-sm",
              filter === "all"
                ? "bg-brass text-night shadow-layered ring-2 ring-brass/40"
                : "glass text-foreground hover:bg-brass/10 hover:text-brass hover:ring-1 hover:ring-brass/30",
            )}
          >
            <Calendar className="size-3.5" />
            <span>{t("events.allFilter")}</span>
            <span
              data-testid="total-events-count-badge"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                filter === "all"
                  ? "bg-night/20 text-night"
                  : "bg-muted text-muted-foreground group-hover:bg-brass/20 group-hover:text-brass",
              )}
            >
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            data-testid="filter-open-events-btn"
            onClick={() => onFilterChange?.("open")}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 shadow-sm",
              filter === "open"
                ? "bg-primary text-primary-foreground shadow-layered ring-2 ring-primary/40"
                : "glass text-foreground hover:bg-primary/10 hover:text-primary hover:ring-1 hover:ring-primary/30",
            )}
          >
            <Sparkles className="size-3.5 text-amber-400" />
            <span>{t("events.openFilter")}</span>
            <span
              data-testid="open-events-count-badge"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                filter === "open"
                  ? "bg-primary-foreground/25 text-primary-foreground"
                  : "bg-primary/15 text-primary",
              )}
            >
              {counts.open}
            </span>
          </button>

          <button
            type="button"
            data-testid="filter-past-events-btn"
            onClick={() => onFilterChange?.("past")}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 shadow-sm",
              filter === "past"
                ? "bg-muted-foreground text-background shadow-layered ring-2 ring-muted-foreground/40"
                : "glass text-foreground hover:bg-muted hover:text-muted-foreground hover:ring-1 hover:ring-border",
            )}
          >
            <History className="size-3.5" />
            <span>{t("events.pastFilter")}</span>
            <span
              data-testid="past-events-count-badge"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold leading-none",
                filter === "past"
                  ? "bg-background/30 text-background"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {counts.past}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
