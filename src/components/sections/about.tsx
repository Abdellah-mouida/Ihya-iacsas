"use client";

import Image from "next/image";
import { useId } from "react";

import { InViewReveal } from "@/components/common/in-view-reveal";
import { MotionCard } from "@/components/common/motion-card";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { useLocale } from "@/i18n/locale-provider";
import { ABOUT_CARDS, IMAGES } from "@/lib/content";

export function About({ branchCount }: { branchCount: number }) {
  const { t, locale } = useLocale();
  const clipId = useId().replace(/:/g, "");
  const formattedBranchCount = new Intl.NumberFormat(locale).format(branchCount);

  return (
    <section id="about" className="relative z-0 overflow-hidden py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <InViewReveal className="mx-auto mb-10 flex max-w-3xl flex-col items-center gap-4 text-center sm:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass">
            <span className="size-1.5 rounded-full bg-brass" />
            {t("about.kicker")}
          </span>
          <h2 className="font-heading text-balance text-3xl font-semibold sm:text-4xl md:text-5xl">
            {t("about.title")}
          </h2>
          <OrnamentDivider compact />
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {t("about.p1")}
          </p>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            {t("about.p2")}
          </p>
        </InViewReveal>

        <InViewReveal className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.15fr)_minmax(0,1fr)] lg:gap-6">
          <div className="order-2 grid gap-4 lg:order-1">
            {ABOUT_CARDS.slice(0, 2).map((card) => (
              <MotionCard key={card.titleKey} intensity={5} radiusClass="rounded-2xl" wrapperClassName="group">
                <article className="glass flex h-full flex-col gap-3 rounded-2xl border border-border/60 p-5 shadow-sm transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-[var(--main)]/40 hover:shadow-card-hover">
                  <span className="grid size-11 place-items-center rounded-xl border border-[var(--main)]/30 bg-[var(--main)]/15 text-[var(--main)]">
                    <card.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-bold text-foreground">{t(card.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
                </article>
              </MotionCard>
            ))}
          </div>

          <div className="order-1 mx-auto w-full max-w-[34rem] lg:order-2">
            <svg aria-hidden="true" className="absolute size-0">
              <defs>
                <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                  <path d="M .16 0 H .84 L 1 .16 V .84 L .84 1 H .16 L 0 .84 V .16 Z" />
                </clipPath>
              </defs>
            </svg>
            <div
              className="relative aspect-[16/9] overflow-hidden bg-card shadow-layered ring-1 ring-brass/30"
              style={{ clipPath: `url(#${clipId})` }}
            >
              <Image
                src={IMAGES.gathering}
                alt=""
                fill
                width={1280}
                height={800}
                sizes="(max-width: 1023px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
            <div className="mx-auto mt-4 flex w-fit items-center gap-3 rounded-2xl glass-strong px-4 py-3 shadow-layered">
              <span className="text-gradient-brass font-heading text-2xl font-bold tabular-nums">{formattedBranchCount}</span>
              <span className="max-w-32 text-xs text-muted-foreground">{t("hero.statBranchesLabel")}</span>
            </div>
          </div>

          <div className="order-3 grid gap-4">
            {ABOUT_CARDS.slice(2).map((card) => (
              <MotionCard key={card.titleKey} intensity={5} radiusClass="rounded-2xl" wrapperClassName="group">
                <article className="glass flex h-full flex-col gap-3 rounded-2xl border border-border/60 p-5 shadow-sm transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-[var(--main)]/40 hover:shadow-card-hover">
                  <span className="grid size-11 place-items-center rounded-xl border border-[var(--main)]/30 bg-[var(--main)]/15 text-[var(--main)]">
                    <card.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-bold text-foreground">{t(card.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
                </article>
              </MotionCard>
            ))}
            <blockquote className="glass rounded-2xl border-s-2 border-brass px-5 py-4 font-heading text-lg leading-relaxed text-foreground">
              {t("about.quote")}
            </blockquote>
          </div>
        </InViewReveal>
      </div>
    </section>
  );
}
