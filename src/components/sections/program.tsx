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
      className="relative isolate flex min-h-[70vh] items-center overflow-visible py-20 text-foreground sm:py-28 z-0"
    >
      {/* A section-sized glow that fades fully before the section edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[5%] inset-y-[10%] z-[1] bg-[radial-gradient(ellipse_55%_55%_at_center,color-mix(in_oklch,var(--gold)_16%,transparent)_0%,transparent_80%)]"
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
          className="inline-flex items-center gap-2 rounded-full border border-brass/25 bg-card/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-foreground backdrop-blur-md"
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
          className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
        >
          {t("program.desc")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8 relative z-10">
          <Button
            asChild
            className="bg-green-gradient h-12 rounded-full px-8 text-base font-semibold text-white shadow-layered ring-1 ring-gold/25 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0"
          >
            <a href="#contact">{t("program.cta")}</a>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
