"use client";

import { SmoothImage } from "@/components/common/smooth-image";
import dynamic from "next/dynamic";

import { InViewReveal } from "@/components/common/in-view-reveal";
import { InViewMount } from "@/components/common/in-view-mount";
import { useLocale } from "@/i18n/locale-provider";
import type { CSSProperties } from "react";
import styles from "./about.module.css";
import { ACTIVITIES, IMAGES } from "@/lib/content";

const CountUp = dynamic(() => import("@/components/common/count-up").then((module) => module.CountUp), { ssr: false });

const ACTIVITY_OUTER_PATH = "M .5 .02 C .65 0 .74 .05 .85 .04 C .98 .04 .99 .17 .98 .3 C .97 .44 1 .57 .98 .7 C .97 .86 .92 .96 .78 .96 C .64 .96 .57 1 .43 .98 C .29 .96 .16 .99 .07 .91 C -.01 .83 .03 .68 .02 .55 C .01 .41 .02 .27 .05 .16 C .08 .04 .2 .03 .34 .04 C .41 .04 .45 .03 .5 .02 Z";
const ACTIVITY_INNER_PATH = "M .5 .07 C .64 .05 .74 .1 .84 .09 C .93 .09 .94 .19 .93 .31 C .92 .44 .95 .57 .93 .7 C .92 .82 .88 .91 .77 .91 C .63 .91 .57 .95 .43 .93 C .3 .91 .19 .94 .11 .88 C .04 .81 .08 .68 .07 .55 C .06 .42 .07 .29 .1 .19 C .13 .1 .22 .09 .35 .09 C .42 .09 .46 .08 .5 .07 Z";

function renderActivityCards(items: typeof ACTIVITIES, translate: (key: string) => string) {
  return items.map((item) => {
    const clipId = `activity-frame-${item.titleKey.replace(/[^a-z0-9-]/gi, "-")}`;
    return (
      <article
        key={item.titleKey}
        data-testid="home-activity-card"
        data-activity-frame={clipId}
        className={`${styles.activityCard} relative isolate flex min-h-48 flex-col justify-center overflow-hidden sm:min-h-56`}
        style={{ "--activity-clip": `url(#${clipId})` } as CSSProperties}
      >
        <span aria-hidden="true" data-testid="activity-surface" className={styles.activitySurface} />
        <svg aria-hidden="true" data-testid="activity-outline" viewBox="0 0 1 1" preserveAspectRatio="none" className={`${styles.activityOutline} pointer-events-none absolute inset-0 size-full text-[var(--main)]`}>
          <defs>
            <clipPath id={clipId} clipPathUnits="objectBoundingBox">
              <path d={ACTIVITY_OUTER_PATH} />
            </clipPath>
          </defs>
          <path d={ACTIVITY_OUTER_PATH} fill="none" stroke="currentColor" strokeOpacity=".62" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <path d={ACTIVITY_INNER_PATH} fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div data-testid="activity-content" className="relative z-10 flex flex-col items-center gap-3 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--main)]/12 text-[var(--main)]">
            <item.icon aria-hidden className="size-5" />
          </span>
          <h3 className="font-heading text-lg font-bold text-foreground">{translate(item.titleKey)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{translate(item.descKey)}</p>
        </div>
      </article>
    );
  });
}

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
            {renderActivityCards(ACTIVITIES.slice(0, 2), t)}
          </div>

          <div className="order-0 flex flex-col items-center justify-center gap-4 sm:col-span-2 lg:order-2 lg:col-span-1">
            <div className="relative size-44 sm:size-52 lg:size-60">
              <SmoothImage
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
            {renderActivityCards(ACTIVITIES.slice(2), t)}
          </div>
        </InViewReveal>
      </div>
    </section>
  );
}
