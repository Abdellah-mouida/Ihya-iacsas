"use client";

import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EventPoster } from "@/components/common/event-poster";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT, IMAGES } from "@/lib/content";
import { fadeUp, slideIn, staggerContainer, viewportOnce } from "@/lib/motion";

type FeaturedEventProps = {
  event?: {
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
};

export function FeaturedEvent({ event }: FeaturedEventProps) {
  const { t, locale, dir } = useLocale();
  const [isBooked, setIsBooked] = useState(false);

  const eventId = event?.id || "majlis-ihyaa";

  useEffect(() => {
    // Check cookie and localStorage for booking recognition
    const hasLocal = localStorage.getItem(`ihyaa_booked_${eventId}`) === "true" ||
      localStorage.getItem("ihyaa_booked_latest") === "true";
    const hasCookie = document.cookie.includes(`ihyaa_booked_${eventId}=true`) ||
      document.cookie.includes("ihyaa_booked_events");

    if (hasLocal || hasCookie) {
      setIsBooked(true);
    }
  }, [eventId]);

  const title = event
    ? locale === "ar"
      ? event.titleAr
      : event.titleEn
    : t("event.name");

  const dateStr = event
    ? new Date(event.date).toLocaleDateString(
        locale === "ar" ? "ar-MA" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : t("event.date");

  const timeStr = event ? event.time : t("event.time");
  const locationStr = event ? event.location : t("event.location");
  const poster = event ? event.posterUrl : IMAGES.eventPoster;
  const bookHref = event ? `/events/majlis-ihyaa/book?eventId=${event.id}` : EVENT.bookHref;

  const details = [
    { icon: CalendarDays, label: t("event.dateLabel"), value: dateStr },
    { icon: Clock, label: t("event.timeLabel"), value: timeStr },
    {
      icon: MapPin,
      label: t("event.locationLabel"),
      value: locationStr,
    },
  ];

  return (
    <section id="event" className="relative overflow-hidden py-24 sm:py-32">
      <div className="bg-spirit-gradient absolute inset-x-0 top-1/2 -z-10 h-[28rem] -translate-y-1/2 opacity-[0.07] blur-3xl" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        {/* Poster */}
        <motion.div
          variants={slideIn(dir === "rtl" ? 1 : -1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="order-1 lg:order-none"
        >
          <EventPoster
            src={poster}
            alt={t("event.posterAlt")}
            badge={t("event.badge")}
          />
        </motion.div>

        {/* Details */}
        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="flex flex-col items-start gap-5 text-start"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass"
          >
            <span className="size-1.5 rounded-full bg-brass" />
            {t("event.kicker")}
          </motion.span>

          <motion.h2
            variants={fadeUp}
            className="font-heading text-3xl font-semibold text-balance sm:text-4xl"
          >
            {t("event.title")}
          </motion.h2>

          <motion.div variants={fadeUp}>
            <OrnamentDivider compact />
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="glass-strong w-full rounded-3xl p-6 shadow-layered transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:ring-1 hover:ring-brass/30 sm:p-8"
          >
            <h3 className="font-heading text-xl font-semibold text-balance sm:text-2xl">
              {title}
            </h3>

            <ul className="mt-6 flex flex-col gap-4">
              {details.map((d) => (
                <li key={d.label} className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25">
                    <d.icon className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {d.label}
                    </span>
                    <span className="font-medium">{d.value}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
              {isBooked ? (
                <div
                  data-testid="booked-state-badge"
                  className="flex items-center gap-2.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-6 py-3 text-emerald-700 dark:text-emerald-300 font-semibold shadow-sm"
                >
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {locale === "ar"
                      ? "أنت مسجل — تم تأكيد حجزك بنجاح!"
                      : "You're booked — your booking was successful!"}
                  </span>
                </div>
              ) : (
                <Button
                  asChild
                  className="bg-brass-gradient h-12 rounded-full px-7 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
                >
                  <Link href={bookHref}>{t("event.cta")}</Link>
                </Button>
              )}
              <a
                href={EVENT.phoneHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brass"
              >
                <Phone className="size-4" />
                <span dir="ltr">
                  {t("event.inquiryLabel")}: {t("event.phone")}
                </span>
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
