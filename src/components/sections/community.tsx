"use client";

import { motion } from "framer-motion";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { fadeUp, scaleIn, staggerContainer, viewportOnce } from "@/lib/motion";

export function Community() {
  const { t } = useLocale();

  return (
    <section
      id="community"
      className="relative isolate flex min-h-[70vh] items-center overflow-hidden bg-night py-28 text-white sm:py-36"
    >
      {/* Calm, quiet backdrop — soft texture + gentle gold glow (no 3D here) */}
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(233,196,106,0.16),transparent_60%)]" />
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
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] backdrop-blur-md"
        >
          <span className="size-1.5 rounded-full bg-gold" />
          {t("community.kicker")}
        </motion.span>

        <motion.h2
          variants={fadeUp}
          className="mt-6 font-heading text-4xl font-semibold text-balance sm:text-5xl md:text-6xl"
        >
          {t("community.title")}
        </motion.h2>

        <motion.div variants={fadeUp} className="mt-5">
          <OrnamentDivider />
        </motion.div>

        <motion.p
          variants={scaleIn}
          className="text-gradient-brass mt-5 font-heading text-3xl font-semibold sm:text-4xl"
        >
          {t("community.quote")}
        </motion.p>

        <motion.p
          variants={fadeUp}
          className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-white/80"
        >
          {t("community.desc")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-8">
          <Button
            asChild
            className="bg-brass-gradient h-12 rounded-full px-8 text-base font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            <a href="#contact">{t("community.cta")}</a>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
