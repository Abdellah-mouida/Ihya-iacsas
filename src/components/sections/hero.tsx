"use client";

import { motion } from "framer-motion";
import { ArrowDown, CalendarDays, Info } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";

import { AuroraBackground } from "@/components/react-bits/aurora-background";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { IMAGES } from "@/lib/content";
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
      className="relative flex min-h-dvh items-center overflow-hidden pt-28 pb-16 text-white"
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
        <div className="absolute inset-0 bg-gradient-to-b from-night/85 via-night/72 to-night/92" />
      </div>

      {/* React Bits aurora — warm animated light over the photo */}
      <AuroraBackground className="-z-20 opacity-60 mix-blend-screen" />

      {/* Inner vignette so the photo edges melt into the section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 [box-shadow:inset_0_0_180px_70px_var(--night)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_center,transparent_42%,var(--night)_100%)] opacity-80"
      />

      {/* Ambient 3D motif */}
      <div aria-hidden className="absolute inset-0 -z-10 opacity-70">
        <HeroScene />
      </div>
      <div className="pattern-islamic absolute inset-0 -z-10" />

      {/* Content */}
      <motion.div
        variants={staggerContainer(0.14, 0.1)}
        initial="hidden"
        animate="show"
        className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 text-center"
      >
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] backdrop-blur-md"
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
          className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/85 sm:text-xl"
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
            <a href="#event">
              <CalendarDays className="size-5" />
              {t("hero.ctaPrimary")}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="glass h-12 rounded-full border-white/25 px-7 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/15 hover:text-white"
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
                i !== 0 && "border-s border-white/15",
              )}
            >
              <dt className="text-shine font-heading text-3xl font-bold sm:text-4xl">
                {s.value}
              </dt>
              <dd className="text-xs text-white/70 sm:text-sm">{s.label}</dd>
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
        className="absolute inset-x-0 bottom-6 mx-auto flex w-max flex-col items-center gap-2 text-white/70"
      >
        <span className="text-[0.7rem] uppercase tracking-[0.2em]">
          {t("hero.scroll")}
        </span>
        <span className="grid size-9 place-items-center rounded-full border border-white/25">
          <ArrowDown className="size-4 animate-bounce" />
        </span>
      </motion.a>
    </section>
  );
}
