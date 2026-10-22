"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin, Maximize2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { getPublicEvents } from "@/app/actions/events";
import { EventFlyerDialog } from "@/components/common/event-flyer-dialog";
import { SectionHeading } from "@/components/common/section-heading";
import { Texture } from "@/components/common/texture";
import { useLocale } from "@/i18n/locale-provider";
import { IMAGES } from "@/lib/content";
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
  const [activeFlyer, setActiveFlyer] = useState<DisplayPastEvent | null>(null);

  useEffect(() => {
    let ignore = false;
    getPublicEvents().then((res) => {
      if (ignore) return;
      if (res.success && res.pastEvents) {
        setPastEvents(
          res.pastEvents.map((pe) => ({
            id: pe.id,
            title: locale === "ar" ? pe.titleAr : pe.titleEn,
            dateStr: new Date(pe.date).toLocaleDateString(
              locale === "ar" ? "ar-MA" : "en-US",
              { year: "numeric", month: "long" },
            ),
            locationStr: pe.location,
            poster: pe.posterUrl || IMAGES.eventPoster,
          })),
        );
      } else {
        setPastEvents([]);
      }
    });
    return () => {
      ignore = true;
    };
  }, [locale]);

  if (!pastEvents || pastEvents.length === 0) return null;

  const displayList: DisplayPastEvent[] = pastEvents;

  return (
    <section id="past-events" className="relative isolate overflow-hidden py-24 sm:py-32 z-0">
      {/* Top transition from open events */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-background to-transparent"
      />
      <Texture pattern="star-rosette" size={72} fade="vertical" />
      <div className="relative z-10 mx-auto max-w-6xl px-5">
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
              data-testid={`past-event-card-${ev.id}`}
              className="group glass relative flex flex-col overflow-hidden rounded-3xl shadow-layered ring-1 ring-border/60 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:shadow-layered hover:ring-brass/30"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setActiveFlyer(ev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveFlyer(ev);
                  }
                }}
                className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <Image
                  src={ev.poster}
                  alt={ev.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-contain transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night/60 via-transparent to-transparent pointer-events-none" />
                <span className="glass-strong absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground pointer-events-none">
                  <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                  {t("events.endedBadge")}
                </span>

                {/* View flyer overlay hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-night/20 backdrop-blur-[2px]">
                  <span className="glass-strong inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brass shadow-lg">
                    <Maximize2 className="size-3.5" />
                    <span>{locale === "ar" ? "عرض الملصق" : "View Poster"}</span>
                  </span>
                </div>
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

      {/* Full-res Flyer Dialog */}
      {activeFlyer && (
        <EventFlyerDialog
          isOpen={!!activeFlyer}
          onOpenChange={(open) => {
            if (!open) setActiveFlyer(null);
          }}
          posterUrl={activeFlyer.poster}
          title={activeFlyer.title}
          dateStr={activeFlyer.dateStr}
          locationStr={activeFlyer.locationStr}
        />
      )}

      {/* Bottom transition into footer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-card/50 to-transparent"
      />
    </section>
  );
}
