"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

const CommunityOrbit = dynamic(
  () => import("@/components/three/community-orbit"),
  { ssr: false },
);

export function Community() {
  const { t } = useLocale();

  return (
    <section
      id="community"
      className="relative isolate flex min-h-[85vh] items-center overflow-hidden bg-night py-28 text-white sm:py-36"
    >
      {/* 3D orbit graphic */}
      <div className="absolute inset-0 -z-20">
        <CommunityOrbit />
      </div>
      {/* readability scrims */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,transparent_0%,var(--night)_78%)]" />
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-40" />

      <motion.div
        variants={staggerContainer(0.14)}
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
          className="mt-6 font-heading text-4xl font-semibold text-balance drop-shadow-lg sm:text-5xl md:text-6xl"
        >
          {t("community.title")}
        </motion.h2>

        <motion.p
          variants={fadeUp}
          className="text-gradient-brass mt-5 font-heading text-2xl font-semibold sm:text-3xl"
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
