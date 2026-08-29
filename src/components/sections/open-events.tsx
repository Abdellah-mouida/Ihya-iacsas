"use client";

import { CalendarClock } from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { OPEN_EVENTS } from "@/lib/content";
import { FeaturedEvent } from "./featured-event";

/**
 * The "open for booking" region of /events. Reuses the FeaturedEvent block
 * (EventPoster + booking flow) for the live event, and degrades gracefully
 * to an empty state so the page structure supports future content.
 */
export function OpenEvents() {
  const { t } = useLocale();

  if (OPEN_EVENTS.length === 0) {
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

  return <FeaturedEvent />;
}
