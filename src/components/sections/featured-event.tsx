"use client";

import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { EventPoster } from "@/components/common/event-poster";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { EVENT, IMAGES } from "@/lib/content";
import { fadeUp, slideIn, staggerContainer, viewportOnce } from "@/lib/motion";

export function FeaturedEvent() {
  const { t, dir } = useLocale();

  const details = [
    { icon: CalendarDays, label: t("event.dateLabel"), value: t("event.date") },
    { icon: Clock, label: t("event.timeLabel"), value: t("event.time") },
    {
      icon: MapPin,
      label: t("event.locationLabel"),
      value: t("event.location"),
    },
  ];

  return (
    <section
      id="event"
      className="relative overflow-hidden py-24 sm:py-32"
    >
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
            src={IMAGES.eventPoster}
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
            className="glass-strong w-full rounded-3xl p-6 shadow-layered sm:p-8"
          >
            <h3 className="font-heading text-xl font-semibold text-balance sm:text-2xl">
              {t("event.name")}
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
              <Button
                asChild
                className="bg-brass-gradient h-12 rounded-full px-7 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
              >
                <Link href={EVENT.bookHref}>{t("event.cta")}</Link>
              </Button>
              <a
                href={EVENT.phoneHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-brass"
              >
                <Phone className="size-4" />
                <span dir="ltr">{t("event.inquiryLabel")}: {t("event.phone")}</span>
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
