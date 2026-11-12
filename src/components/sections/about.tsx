"use client";

import Image from "next/image";
import dynamic from "next/dynamic";

import { InViewReveal } from "@/components/common/in-view-reveal";
import { InViewMount } from "@/components/common/in-view-mount";
import { useLocale } from "@/i18n/locale-provider";
import { ACTIVITIES, IMAGES } from "@/lib/content";

const CountUp = dynamic(() => import("@/components/common/count-up").then((module) => module.CountUp), { ssr: false });

export function About({ branchCount }: { branchCount: number }) {
  const { t, locale } = useLocale();
  const formattedBranchCount = new Intl.NumberFormat(locale).format(branchCount);

  return (
    <section id="about" className="relative z-0 overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <InViewReveal className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-3 text-center sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
            <span className="size-1.5 rounded-full bg-brass" />
            {t("about.kicker")}
          </span>
          <h2 className="font-heading text-balance text-3xl font-semibold sm:text-4xl md:text-5xl">
            {t("about.title")}
          </h2>
          <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("about.p1")}
          </p>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {t("about.p2")}
          </p>
        </InViewReveal>

        <InViewReveal className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)_minmax(0,1fr)] lg:items-center lg:gap-6">
          <div className="order-1 grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
            {ACTIVITIES.slice(0, 2).map((item) => (
              <article key={item.titleKey} data-testid="home-activity-card" className="relative isolate flex min-h-48 flex-col justify-center gap-3 overflow-hidden rounded-[2rem] bg-card/65 px-5 py-6 shadow-sm backdrop-blur-sm sm:min-h-56 sm:px-7">
                <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-[var(--main)]">
                  <path d="M50 2 C65 0 74 5 85 4 C98 4 99 17 98 30 C97 44 100 57 98 70 C97 86 92 96 78 96 C64 96 57 100 43 98 C29 96 16 99 7 91 C-1 83 3 68 2 55 C1 41 2 27 5 16 C8 4 20 3 34 4 C41 4 45 3 50 2Z" fill="none" stroke="currentColor" strokeOpacity=".62" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                  <path d="M50 7 C64 5 74 10 84 9 C93 9 94 19 93 31 C92 44 95 57 93 70 C92 82 88 91 77 91 C63 91 57 95 43 93 C30 91 19 94 11 88 C4 81 8 68 7 55 C6 42 7 29 10 19 C13 10 22 9 35 9 C42 9 46 8 50 7Z" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="relative z-10 grid size-10 place-items-center rounded-xl bg-[var(--main)]/12 text-[var(--main)]">
                  <item.icon aria-hidden className="size-5" />
                </span>
                <h3 className="relative z-10 font-heading text-lg font-bold text-foreground">{t(item.titleKey)}</h3>
                <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">{t(item.descKey)}</p>
              </article>
            ))}
          </div>

          <div className="order-0 flex flex-col items-center justify-center gap-4 sm:col-span-2 lg:order-2 lg:col-span-1">
            <div className="relative size-44 sm:size-52 lg:size-60">
              <Image
                src={IMAGES.logoCircle}
                alt={locale === "ar" ? "شعار برنامج إحياء" : "Ihyaa program logo"}
                fill
                width={512}
                height={512}
                sizes="(max-width: 639px) 176px, (max-width: 1023px) 208px, 240px"
                className="object-contain"
              />
            </div>
            <div className="flex items-center gap-3 rounded-2xl glass-strong px-4 py-3 shadow-layered">
              <InViewMount
                className="text-gradient-brass font-heading text-2xl font-bold tabular-nums"
                minHeight="2rem"
                placeholder={<span aria-hidden="true">{formattedBranchCount}</span>}
              >
                <CountUp value={branchCount} locale={locale} />
              </InViewMount>
              <span className="max-w-32 text-xs text-muted-foreground">{t("hero.statBranchesLabel")}</span>
            </div>
          </div>

          <div className="order-2 grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:order-3 lg:col-span-1 lg:grid-cols-1">
            {ACTIVITIES.slice(2).map((item) => (
              <article key={item.titleKey} data-testid="home-activity-card" className="relative isolate flex min-h-48 flex-col justify-center gap-3 overflow-hidden rounded-[2rem] bg-card/65 px-5 py-6 shadow-sm backdrop-blur-sm sm:min-h-56 sm:px-7">
                <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-[var(--main)]">
                  <path d="M50 2 C65 0 74 5 85 4 C98 4 99 17 98 30 C97 44 100 57 98 70 C97 86 92 96 78 96 C64 96 57 100 43 98 C29 96 16 99 7 91 C-1 83 3 68 2 55 C1 41 2 27 5 16 C8 4 20 3 34 4 C41 4 45 3 50 2Z" fill="none" stroke="currentColor" strokeOpacity=".62" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
                  <path d="M50 7 C64 5 74 10 84 9 C93 9 94 19 93 31 C92 44 95 57 93 70 C92 82 88 91 77 91 C63 91 57 95 43 93 C30 91 19 94 11 88 C4 81 8 68 7 55 C6 42 7 29 10 19 C13 10 22 9 35 9 C42 9 46 8 50 7Z" fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="relative z-10 grid size-10 place-items-center rounded-xl bg-[var(--main)]/12 text-[var(--main)]">
                  <item.icon aria-hidden className="size-5" />
                </span>
                <h3 className="relative z-10 font-heading text-lg font-bold text-foreground">{t(item.titleKey)}</h3>
                <p className="relative z-10 text-sm leading-relaxed text-muted-foreground">{t(item.descKey)}</p>
              </article>
            ))}
          </div>

          <blockquote className="order-3 glass rounded-2xl border-s-2 border-brass px-5 py-4 text-center font-heading text-lg leading-relaxed text-foreground sm:col-span-2 lg:order-4 lg:col-start-1 lg:col-span-3">
            {t("about.quote")}
          </blockquote>
        </InViewReveal>
      </div>
    </section>
  );
}
