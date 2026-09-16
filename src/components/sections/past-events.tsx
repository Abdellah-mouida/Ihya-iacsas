"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { PAST_EVENTS } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

type DisplayPastEvent = {
  id: string;
  title: string;
  dateStr: string;
  locationStr: string;
  poster: string;
};

export function PastEvents() {
  const { t, locale } = useLocale();
  const [pastEvents, setPastEvents] = useState<DisplayPastEvent[] | null>(null);

  useEffect(() => {
    getPublicEvents().then((res) => {
      if (res.success && res.pastEvents && res.pastEvents.length > 0) {
        setPastEvents(
          res.pastEvents.map((pe) => ({
            id: pe.id,
            title: locale === "ar" ? pe.titleAr : pe.titleEn,
            dateStr: new Date(pe.date).toLocaleDateString(
              locale === "ar" ? "ar-MA" : "en-US",
              { year: "numeric", month: "long" },
            ),
            locationStr: pe.location,
            poster: pe.posterUrl,
          })),
        );
      }
    });
  }, [locale]);

  const displayList: DisplayPastEvent[] =
    pastEvents !== null
      ? pastEvents
      : PAST_EVENTS.map((ev) => ({
          id: ev.id,
          title: t(ev.titleKey),
          dateStr: t(ev.dateKey),
          locationStr: t(ev.locationKey),
          poster: ev.poster,
        }));

  if (displayList.length === 0) return null;

  return (
    <section id="past-events" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-40" />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("events.pastKicker")}
          title={t("events.pastTitle")}
          desc={t("events.pastDesc")}
        />

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {displayList.map((ev) => (
            <motion.article
              key={ev.id}
              variants={fadeUp}
              className="group glass relative flex flex-col overflow-hidden rounded-3xl shadow-layered ring-1 ring-border/60 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-layered hover:ring-brass/30"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={ev.poster}
                  alt={ev.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night/70 via-night/10 to-transparent" />
                <span className="glass-strong absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                  {t("events.endedBadge")}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-6">
                <h3 className="font-heading text-xl font-semibold text-balance">
                  {ev.title}
                </h3>
                <div className="mt-auto flex flex-col gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-brass" />
                    {ev.dateStr}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-brass" />
                    {ev.locationStr}
                  </span>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
