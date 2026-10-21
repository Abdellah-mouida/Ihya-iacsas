"use client";

import { motion } from "framer-motion";
import { ArrowDown, CalendarDays, Info } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";

import { AuroraBackground } from "@/components/react-bits/aurora-background";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { EVENTS_HREF, IMAGES } from "@/lib/content";
import { fadeUp, staggerContainer } from "@/lib/motion";

const HeroScene = dynamic(() => import("@/components/three/hero-scene"), {
  ssr: false,
});

export function Hero() {
  const { t } = useLocale();

  return (
<section
      id="home"
      className="relative flex min-h-dvh items-center overflow-hidden pt-28 pb-32 text-foreground"
    >
      {/* Photo layer */}
      <div className="absolute inset-0 -z-30">
        <Image
          src={IMAGES.groupPortrait}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Soft theme-aware scrim allowing the photo to remain clearly visible at center */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/35 to-background/75 dark:from-night/60 dark:via-night/45 dark:to-night/80" />
      </div>

      {/* React Bits aurora — warm animated light over the photo with gentle blend */}
      <AuroraBackground className="-z-20 opacity-25 mix-blend-screen dark:opacity-35" />

      {/* Corner vignette: soft perimeter darkening leaving center open and photo crisp */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 [box-shadow:inset_0_0_140px_40px_var(--background)] dark:[box-shadow:inset_0_0_140px_40px_var(--night)] opacity-60"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_center,transparent_60%,var(--background)_100%)] opacity-40 dark:opacity-50"
      />

      {/* Faint Mandala pattern texture */}
      <div className="texture-surface texture-mandala -z-10 !opacity-[0.06]" />

      {/* Ambient drifting particles */}
      <div aria-hidden className="absolute inset-0 -z-10 opacity-80">
        <HeroScene />
      </div>

      {/* Content */}
      <motion.div
        variants={staggerContainer(0.14, 0.1)}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 text-center"
      >
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-background/85 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground shadow-xs backdrop-blur-md"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-gold" />
          {t("hero.kicker")}
        </motion.span>

        <motion.h1
          variants={fadeUp}
          className="mt-6 font-heading text-7xl font-extrabold leading-[0.95] sm:text-8xl md:text-9xl"
        >
          <span className="text-shine">{t("hero.title")}</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/80 sm:text-xl"
        >
          {t("hero.subtitle")}
        </motion.p>

        <motion.div
          variants={fadeUp}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button
            asChild
            className="bg-brass-gradient h-12 rounded-full px-7 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            <Link href={EVENTS_HREF}>
              <CalendarDays className="size-5" />
              {t("hero.ctaPrimary")}
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="glass h-12 rounded-full border-border/70 px-7 text-base font-semibold text-foreground/95 transition-all hover:-translate-y-0.5 hover:bg-muted/60 dark:border-border/60 dark:hover:bg-accent/40"
          >
            <a href="#about">
              <Info className="size-5" />
              {t("hero.ctaSecondary")}
            </a>
          </Button>
        </motion.div>
      </motion.div>

      {/* Bottom fade into the subsequent section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-b from-transparent via-background/60 to-background dark:via-background/80 dark:to-background"
      />

      {/* Scroll cue */}
      <motion.a
        href="#about"
        aria-label={t("hero.scroll")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute inset-x-0 bottom-6 mx-auto flex w-max flex-col items-center gap-2 text-foreground/80 dark:text-foreground/90 transition-colors hover:text-foreground"
      >
        <span className="text-[0.75rem] font-medium uppercase tracking-[0.2em]">
          {t("hero.scroll")}
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-foreground/25 dark:border-white/25">
          <ArrowDown className="size-4 animate-bounce" />
        </span>
      </motion.a>
    </section>
  );
}
