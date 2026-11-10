"use client";

import { Fragment, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Info } from "lucide-react";

import styles from "./hero.module.css";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { ACTIVITIES, EVENTS_HREF, IMAGES } from "@/lib/content";

const STICKERS = [
  "hero.stickerValues",
  "hero.stickerCompanionship",
  "hero.stickerGiving",
] as const;

function groupPortraitLoader({ width }: { width: number }) {
  // Use pre-encoded AVIF widths so first-view LCP does not wait for a cold optimizer encode.
  if (width >= 3840) return IMAGES.groupPortrait;
  return `/images/group-portrait-hero-${width}.avif`;
}

export function Hero() {
  const { t, dir } = useLocale();
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const photoParallax = useTransform(scrollYProgress, [0, 1], [0, 28]);
  const copyRise = useTransform(scrollYProgress, [0, 1], [0, 22]);
  const copyFade = useTransform(scrollYProgress, [0, 0.9], [1, 0.72]);
  const headline = t("hero.title");
  const words = headline.split(/\s+/).filter(Boolean);

  function tiltPhoto(event: React.PointerEvent<HTMLDivElement>) {
    if (
      reducedMotion ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      !event.currentTarget
    ) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${-y * 2.2}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${x * 2.2}deg`);
  }

  function resetPhotoTilt(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <section
      id="home"
      ref={heroRef}
      dir={dir}
      className="relative z-10 mb-[-3.5rem] overflow-visible px-4 pt-24 pb-0 text-foreground sm:px-6 sm:pt-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-9 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
        <motion.div
          data-testid="hero-copy"
          style={reducedMotion ? undefined : { y: copyRise, opacity: copyFade }}
          className="relative z-10 order-2 flex flex-col items-start text-start lg:order-1"
        >
          <p className="w-full text-base font-semibold text-[var(--main)] sm:text-lg">
            {t("hero.programName")}
          </p>
          <h1 className="mt-3 min-h-[2.2em] w-full text-balance font-heading text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-[clamp(3rem,4.2vw,4.25rem)]">
            {words.map((word, index) => (
              <Fragment key={`${word}-${index}`}>
                <span data-testid="hero-heading-word" className={styles.wordMask}>
                  <span
                    className={styles.word}
                    style={{ animationDelay: `${index * 90}ms` }}
                  >
                    {word}
                  </span>
                </span>
                {index < words.length - 1 ? " " : null}
              </Fragment>
            ))}
          </h1>
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
                <span dir="auto">{t("hero.ctaPrimary")}</span>
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
                <span dir="auto">{t("hero.ctaSecondary")}</span>
              </a>
            </Button>
          </div>
        </motion.div>

        <div
          className={`${styles.tiltFrame} order-1 lg:order-2`}
          onPointerMove={tiltPhoto}
          onPointerLeave={resetPhotoTilt}
        >
          <div dir="ltr" className={`${styles.stickerRow} relative z-10 mx-auto mb-2 flex w-full max-w-[760px] items-center justify-between`}>
            {STICKERS.map((key) => (
              <span
                key={key}
                data-testid="hero-sticker"
                className={`${styles.sticker} grid h-8 w-[5.25rem] place-items-center rounded-full bg-background/90 px-2 text-center text-xs font-semibold text-[var(--main)]`}
              >
                {t(key)}
              </span>
            ))}
          </div>
          <motion.div
            data-testid="hero-frame"
            style={reducedMotion ? undefined : { y: photoParallax }}
            className={`${styles.archFrame} relative mx-auto w-full max-w-[760px]`}
          >
            <div data-testid="hero-photo-frame" className={`${styles.photoReveal} relative aspect-[1.351/1] overflow-hidden`}>
              <Image
                src={IMAGES.groupPortraitHero}
                loader={groupPortraitLoader}
                alt={t("hero.photoAlt")}
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) calc(100vw - 3rem), (max-width: 1199px) calc(55vw - 3.3rem), 607px"
                className={`${styles.photoDrift} object-cover object-center`}
              />
            </div>
          </motion.div>
        </div>
      </div>

      <div
        role="region"
        aria-label={t("hero.activitiesMarquee")}
        tabIndex={0}
        dir="ltr"
        data-testid="hero-marquee"
        className={`${styles.marquee} relative z-20 mt-2 flex h-14 items-center overflow-hidden py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--main)]`}
      >
        <div data-testid="hero-marquee-track" className={styles.marqueeTrack}>
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              aria-hidden={copy === 1 ? true : undefined}
              className="flex shrink-0 items-center gap-8 pe-8 text-lg font-semibold sm:gap-12 sm:pe-12"
            >
              {ACTIVITIES.map((activity) => (
                <li key={`${copy}-${activity.num}`} dir="auto" className="flex h-8 w-32 shrink-0 items-center justify-center whitespace-nowrap text-center">
                  {t(activity.titleKey)}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
