"use client";

import { SmoothImage } from "@/components/common/smooth-image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Info } from "lucide-react";

import styles from "./hero.module.css";
import { Button } from "@/components/ui/button";
import { InViewMount } from "@/components/common/in-view-mount";
import { useLocale } from "@/i18n/locale-provider";
import { EVENTS_HREF, IMAGES } from "@/lib/content";
import { useLowPower } from "@/hooks/use-low-power";
import FoldText from "@/components/FoldText";
function groupPortraitLoader({ width }: { width: number }) {
  // shortcut: serve the nearest pre-encoded AVIF; cap at 2048px to avoid a missing srcset candidate.
  const availableWidths = [384, 640, 750, 828, 1080, 1200, 1800, 1920, 2048];
  const selectedWidth =
    availableWidths.find((candidate) => candidate >= width) ?? 2048;
  return `/images/group-portrait-hero-${selectedWidth}.avif`;
}

export function Hero() {
  const { t, locale } = useLocale();
  const lowPower = useLowPower();
  const sectionRef = useRef<HTMLElement>(null);
  const [foldPaused, setFoldPaused] = useState(false);
  const headline = t("hero.title");

  const handleFoldStateChange = useCallback((state: string) => {
    const section = sectionRef.current;
    if (!section || lowPower) return;
    section.dataset.foldState = state;
  }, [lowPower]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || lowPower) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        section.dataset.foldVisible = String(visible);
        section.dataset.foldPaused = String(!visible);
        setFoldPaused(!visible);
      },
      { threshold: 0.1 },
    );
    observer.observe(section);
    return () => {
      observer.disconnect();
      delete section.dataset.foldVisible;
      delete section.dataset.foldState;
      delete section.dataset.foldPaused;
    };
  }, [lowPower]);

  return (
    <section
      ref={sectionRef}
      id="home"
      className="relative z-10 mb-[-3.5rem] overflow-visible px-4 pt-24 pb-0 text-foreground sm:px-6 sm:pt-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <div
          data-testid="hero-copy"
          className="relative z-10 order-2 flex flex-col items-start text-start lg:order-1"
        >
          <p className="w-full text-base font-semibold text-[var(--main)] sm:text-lg">
            {t("hero.programName")}
          </p>

          <FoldText
            as="h1"
            data-rb="FoldText"
            text={headline}
            ariaLabel={headline}
            foldStyle="paper"
            splitBy={locale === "ar" ? "word" : "char"}
            hinge="top"
            trigger="mount"
            foldAngle={92}
            duration={0.65}
            stagger={0.045}
            staggerFrom="start"
            ease="power3.out"
            loopDelay={1.4}
            hoverRefold={!lowPower}
            refoldRadius={140}
            refoldAngle={45}
            perspective={700}
            creaseShading={0.55}
            fontSize="inherit"
            fontWeight={800}
            gradient={["var(--hero-title-start)", "var(--hero-title-end)"]}
            disabled={lowPower}
            paused={foldPaused}
            onStateChange={handleFoldStateChange}
            wordTestId="hero-heading-word"
            pieceTestId="hero-fold-piece"
            className={`${styles.heroTitle} mt-3 block min-h-[3.4em] w-full max-w-[21ch] text-balance font-heading text-[clamp(1.55rem,7.8vw,3rem)] font-extrabold ${locale === "ar" ? "leading-[1.28]" : "leading-[1.12]"} lg:min-h-[2.3em] lg:max-w-none lg:text-[clamp(3rem,4.2vw,4.25rem)]`}
          />

          <p className="mt-5 min-h-[3em] w-full max-w-[30rem] text-pretty text-base leading-relaxed text-foreground sm:text-lg">
            {t("hero.subtitle")}
          </p>
          <div className="mt-7 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-full bg-[var(--main)] px-6 font-semibold text-background transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90 sm:w-auto"
            >
              <Link href={EVENTS_HREF} dir="ltr">
                <CalendarDays aria-hidden className="size-5" />
                <span dir="auto" className="inline-block w-40 text-center">
                  {t("hero.ctaPrimary")}
                </span>
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 w-full rounded-full px-5 text-foreground transition-[transform,background-color] hover:-translate-y-0.5 sm:w-auto"
            >
              <a href="#about" dir="ltr">
                <Info aria-hidden className="size-5" />
                <span dir="auto" className="inline-block w-40 text-center">
                  {t("hero.ctaSecondary")}
                </span>
              </a>
            </Button>
          </div>
        </div>

        <div
          data-testid="hero-frame"
          className={`${styles.frameWrap} order-1 lg:order-2`}
        >
          <svg
            aria-hidden="true"
            className={styles.clipDefinitions}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            <defs>
              <clipPath
                id="ihyaa-hero-splash"
                clipPathUnits="objectBoundingBox"
              >
                <path d="M .08 .24 C .11 .14 .23 .10 .33 .15 C .41 .06 .53 .04 .61 .12 C .72 .08 .83 .13 .86 .24 C .96 .25 .99 .35 .95 .44 C 1 .54 .97 .64 .91 .70 C .96 .81 .87 .91 .77 .89 C .69 .98 .58 .97 .50 .92 C .40 .99 .29 .93 .25 .84 C .14 .89 .05 .82 .09 .72 C .01 .64 .03 .52 .08 .44 C .02 .36 .03 .29 .08 .24 Z" />
              </clipPath>
            </defs>
          </svg>
          <InViewMount className={styles.ornamentHost}>
            <svg
              aria-hidden="true"
              className={
                lowPower
                  ? styles.splashOrnaments
                  : `${styles.splashOrnaments} ${styles.drift}`
              }
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path d="M 8 24 C 11 14 23 10 33 15 C 41 6 53 4 61 12 C 72 8 83 13 86 24 C 96 25 99 35 95 44 C 100 54 97 64 91 70 C 96 81 87 91 77 89 C 69 98 58 97 50 92 C 40 99 29 93 25 84 C 14 89 5 82 9 72 C 1 64 3 52 8 44 C 2 36 3 29 8 24 Z" />
              <circle cx="28" cy="8" r="1.7" />
              <circle cx="72" cy="5" r="1.1" />
              <circle cx="92" cy="19" r="1.3" />
            </svg>
          </InViewMount>
          <div
            data-testid="hero-photo-frame"
            className={`${styles.photoFrame} relative mx-auto aspect-[1.351/1] w-full max-w-[760px]`}
          >
            <SmoothImage
              src={IMAGES.groupPortraitHero}
              loader={groupPortraitLoader}
              alt={t("hero.photoAlt")}
              fill
              priority
              fadeDurationMs={250}
              fetchPriority="high"
              sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc(100vw - 3rem), (max-width: 1199px) calc(55vw - 3.3rem), 607px"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
