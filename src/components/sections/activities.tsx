"use client";

import { InViewReveal } from "@/components/common/in-view-reveal";
import { SectionHeading } from "@/components/common/section-heading";
import { SpotlightCard } from "@/components/common/spotlight-card";
import { Texture } from "@/components/common/texture";
import { useLocale } from "@/i18n/locale-provider";
import { ACTIVITIES } from "@/lib/content";

export function Activities() {
  const { t } = useLocale();

  return (
    <section id="activities" className="relative isolate overflow-hidden py-24 sm:py-32 z-0">
      <div className="relative z-10 mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("activities.kicker")}
          title={t("activities.title")}
          desc={t("activities.desc")}
        />

        <InViewReveal
          className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4"
        >
          {ACTIVITIES.map((item) => (
            <div key={item.num} className="group h-full" data-testid="home-activity-card">
              <SpotlightCard className="rounded-3xl">
                <div className="glass relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl p-8 text-foreground shadow-layered transition-[box-shadow,transform,border-color] duration-300 group-hover:-translate-y-0.8 group-hover:border-primary/40 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] dark:group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.4)] sm:p-9">
                  {/* Card Texture in --main with radial fade */}
                  <Texture pattern="star-rosette" size={56} fade="radial" opacity={0.07} className="rounded-3xl" />

                  {/* Subtle corner ornament watermark */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-8 -end-8 size-32 opacity-[0.07] dark:opacity-[0.14] transition-transform duration-500 group-hover:scale-110 z-[3]"
                    style={{
                      backgroundImage: `url('/patterns/corner-ornament.svg')`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />

                  {/* Top Header Row with Icon and Numeral */}
                  <div className="flex items-center justify-between">
                    <span
                      className="grid size-14 place-items-center rounded-2xl bg-[var(--main)]/15 text-[var(--main)] border border-[var(--main)]/30 shadow-sm transition-colors duration-300 group-hover:bg-[var(--main)] group-hover:text-background"
                    >
                      <item.icon className="size-7" />
                    </span>
                    <span className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground/15 dark:text-foreground/20 font-mono">
                      {item.num}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div className="mt-auto flex flex-col gap-2.5 pt-4">
                    <h3 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(item.descKey)}
                    </p>
                  </div>
                </div>
              </SpotlightCard>
            </div>
          ))}
        </InViewReveal>
      </div>
    </section>
  );
}
