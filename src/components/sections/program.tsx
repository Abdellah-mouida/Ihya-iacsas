"use client";

import { motion } from "framer-motion";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { fadeUp, scaleIn, staggerContainer, viewportOnce } from "@/lib/motion";

export function Program() {
  const { t } = useLocale();

  return (
    <section
      id="program"
      className="relative isolate flex min-h-[70vh] items-center overflow-x-clip py-28 text-foreground dark:bg-night dark:text-white sm:py-36"
    >
      {/* Smooth top and bottom transitions */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-36 bg-gradient-to-b from-background via-background/40 to-transparent dark:from-background dark:via-night/60 dark:to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-36 bg-gradient-to-t from-background via-background/40 to-transparent dark:from-background dark:via-night/60 dark:to-transparent"
      />

      {/* Calm, quiet backdrop — soft texture + gentle gold glow (no 3D here).
          Transparent in light mode so it blends with the page (texture fades
          at its own edges); a dark band only in dark mode. */}
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--gold)_16%,transparent),transparent_60%)]" />
      <div
        aria-hidden
        className="bg-brass-gradient animate-float-slow absolute left-1/2 top-1/2 -z-10 size-[38rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] blur-3xl"
      />

      <motion.div
        variants={staggerContainer(0.16)}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
        className="mx-auto flex max-w-3xl flex-col items-center px-5 text-center"
      >
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground backdrop-blur-md dark:border-white/20 dark:bg-white/10 dark:text-white"
        >
          <span className="size-1.5 rounded-full bg-green" />
          {t("program.kicker")}
        </motion.span>

        <motion.h2
          variants={fadeUp}
          className="mt-6 font-heading text-4xl font-semibold text-balance sm:text-5xl md:text-6xl"
        >
          {t("program.title")}
        </motion.h2>

        <motion.div variants={fadeUp} className="mt-5">
          <OrnamentDivider />
        </motion.div>

        <motion.p
          variants={scaleIn}
          className="text-gradient-brass mt-5 font-heading text-3xl font-semibold sm:text-4xl"
        >
          {t("program.quote")}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground dark:text-white/80"
        >
          {t("program.desc")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8">
          <Button
            asChild
            className="bg-green-gradient h-12 rounded-full px-8 text-base font-semibold text-white shadow-layered ring-1 ring-gold/25 transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            <a href="#contact">{t("program.cta")}</a>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
