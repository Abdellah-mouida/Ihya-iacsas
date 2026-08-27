"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import { MotionCard } from "@/components/common/motion-card";
import { OrnamentDivider } from "@/components/common/ornament-divider";
import { useLocale } from "@/i18n/locale-provider";
import { ABOUT_CARDS, IMAGES } from "@/lib/content";
import { fadeUp, slideIn, staggerContainer, viewportOnce } from "@/lib/motion";

export function About() {
  const { t, dir } = useLocale();

  return (
    <section id="about" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pattern-islamic absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
        {/* Text column */}
        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="flex flex-col items-start gap-5 text-start"
        >
          <motion.span
            variants={fadeUp}
            className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass"
          >
            <span className="size-1.5 rounded-full bg-brass" />
            {t("about.kicker")}
          </motion.span>
          <motion.h2
            variants={fadeUp}
            className="font-heading text-3xl font-semibold text-balance sm:text-4xl md:text-5xl"
          >
            {t("about.title")}
          </motion.h2>
          <motion.div variants={fadeUp}>
            <OrnamentDivider compact />
          </motion.div>
          <motion.p
            variants={fadeUp}
            className="text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            {t("about.p1")}
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="text-pretty leading-relaxed text-muted-foreground"
          >
            {t("about.p2")}
          </motion.p>
          <motion.blockquote
            variants={fadeUp}
            className="glass mt-2 rounded-2xl border-s-2 border-brass px-5 py-4 font-heading text-xl text-foreground"
          >
            {t("about.quote")}
          </motion.blockquote>
        </motion.div>

        {/* Visual column */}
        <motion.div
          variants={slideIn(dir === "rtl" ? -1 : 1)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="flex flex-col gap-5"
        >
          <div className="relative">
            <div className="arch-top relative overflow-hidden shadow-layered ring-1 ring-brass/30">
              <Image
                src={IMAGES.journeyCard}
                alt=""
                width={526}
                height={526}
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="h-64 w-full object-cover sm:h-72"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-night/50 to-transparent" />
            </div>
            <div className="glass-strong absolute -bottom-5 end-5 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-layered">
              <span className="text-gradient-brass font-heading text-2xl font-bold">
                {t("hero.statBranchesValue")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("hero.statBranchesLabel")}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {ABOUT_CARDS.map((card) => (
              <MotionCard
                key={card.titleKey}
                intensity={10}
                glare={false}
                radiusClass="rounded-2xl"
              >
                <div className="glass flex h-full flex-col gap-3 rounded-2xl p-5 transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-1 hover:shadow-layered hover:ring-1 hover:ring-brass/30">
                  <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25">
                    <card.icon className="size-5" />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(card.descKey)}
                  </p>
                </div>
              </MotionCard>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
