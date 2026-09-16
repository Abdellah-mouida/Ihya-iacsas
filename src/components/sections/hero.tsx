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
import { cn } from "@/lib/utils";

const HeroScene = dynamic(() => import("@/components/three/hero-scene"), {
  ssr: false,
});

export function Hero() {
  const { t } = useLocale();

  const stats = [
    { value: t("hero.statBranchesValue"), label: t("hero.statBranchesLabel") },
    { value: t("hero.statMembersValue"), label: t("hero.statMembersLabel") },
    { value: t("hero.statEventsValue"), label: t("hero.statEventsLabel") },
  ];

  return (
<section
      id="home"
      className="relative flex min-h-dvh items-center overflow-hidden pt-28 pb-32 text-white"
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
        {/* Scrim: a light warm wash in light mode, deep night in dark mode. */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/80 to-background/94 dark:from-night/85 dark:via-night/72 dark:to-night/92" />
      </div>

      {/* React Bits aurora — warm animated light over the photo */}
      <AuroraBackground className="-z-20 opacity-50 mix-blend-screen dark:opacity-60" />

      {/* Inner vignette: strong at corners/edges, transparent at center (theme-aware) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 [box-shadow:inset_0_0_200px_80px_var(--background)] dark:[box-shadow:inset_0_0_200px_80px_var(--night)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_center,transparent_50%,var(--background)_100%)] opacity-70 dark:bg-[radial-gradient(ellipse_at_center,transparent_50%,var(--night)_100%)] dark:opacity-70"
      />

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
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] backdrop-blur-md dark:border-white/20 dark:bg-white/10"
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
          className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-foreground/80 dark:text-white/85 sm:text-xl"
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
            className="glass h-12 rounded-full border-foreground/20 px-7 text-base font-semibold text-foreground transition-all hover:-translate-y-0.5 hover:bg-foreground/5 dark:border-white/25 dark:text-white dark:hover:bg-white/15 dark:hover:text-white"
          >
            <a href="#about">
              <Info className="size-5" />
              {t("hero.ctaSecondary")}
            </a>
          </Button>
        </motion.div>

        <motion.dl
          variants={fadeUp}
          className="mt-14 grid w-full max-w-2xl grid-cols-3 gap-4"
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col items-center gap-1 px-2",
                i !== 0 && "border-s border-foreground/15 dark:border-white/15",
              )}
            >
              <dt className="text-shine font-heading text-3xl font-bold sm:text-4xl">
                {s.value}
              </dt>
              <dd className="text-xs text-muted-foreground dark:text-white/70 sm:text-sm">
                {s.label}
              </dd>
            </div>
          ))}
        </motion.dl>
      </motion.div>

      {/* Scroll cue */}
      <motion.a
        href="#about"
        aria-label={t("hero.scroll")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute inset-x-0 bottom-6 mx-auto flex w-max flex-col items-center gap-2 text-muted-foreground dark:text-white/70"
      >
        <span className="text-[0.7rem] uppercase tracking-[0.2em]">
          {t("hero.scroll")}
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-foreground/25 dark:border-white/25">
          <ArrowDown className="size-4 animate-bounce" />
        </span>
      </motion.a>
    </section>
  );
}
