"use client";

import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";

export function EventsHeader() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-x-clip pt-36 pb-4 sm:pt-40">
      {/* Ambient brass glow to anchor the page header */}
      <div
        aria-hidden
        className="bg-brass-gradient absolute left-1/2 top-24 -z-10 size-72 max-w-[80vw] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
      />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("events.kicker")}
          title={t("events.title")}
          desc={t("events.desc")}
        />
      </div>
    </section>
  );
}
