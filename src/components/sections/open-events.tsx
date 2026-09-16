"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { useLocale } from "@/i18n/locale-provider";
import { OPEN_EVENTS } from "@/lib/content";
import { FeaturedEvent } from "./featured-event";

type DbEvent = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  date: Date;
  time: string;
  location: string;
  posterUrl: string;
};

export function OpenEvents() {
  const { t } = useLocale();
  const [openEvents, setOpenEvents] = useState<DbEvent[] | null>(null);

  useEffect(() => {
    getPublicEvents().then((res) => {
      if (res.success && res.openEvents && res.openEvents.length > 0) {
        setOpenEvents(res.openEvents as unknown as DbEvent[]);
      } else if (res.success) {
        setOpenEvents([]);
      }
    });
  }, []);

  const activeEvents = openEvents !== null ? openEvents : OPEN_EVENTS;

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

  const primaryEvent = openEvents && openEvents.length > 0 ? openEvents[0] : undefined;

  return <FeaturedEvent event={primaryEvent} />;
}
