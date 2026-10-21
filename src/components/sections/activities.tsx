"use client";

import { motion } from "framer-motion";

import { MotionCard } from "@/components/common/motion-card";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { ACTIVITIES } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function Activities() {
  const { t } = useLocale();

  return (
    <section id="activities" className="relative py-24 sm:py-32">
      <div className="texture-surface texture-star-rosette -z-10" />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("activities.kicker")}
          title={t("activities.title")}
          desc={t("activities.desc")}
        />

        <motion.div
          variants={staggerContainer(0.14)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {ACTIVITIES.map((item, idx) => (
            <motion.div key={item.num} variants={fadeUp} className="group h-full">
              <MotionCard intensity={10} className="h-full">
                <div className="glass preserve-3d relative flex h-full flex-col gap-5 overflow-hidden rounded-3xl p-8 sm:p-9 text-foreground shadow-layered transition-[box-shadow,transform,border-color] duration-300 group-hover:-translate-y-1.5 group-hover:border-primary/40 group-hover:shadow-2xl">
                  {/* Subtle corner ornament watermark */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-8 -end-8 size-32 opacity-[0.07] dark:opacity-[0.14] transition-transform duration-500 group-hover:scale-110"
                    style={{
                      backgroundImage: `url('/patterns/corner-ornament.svg')`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                    }}
                  />

                  {/* Top Header Row with Icon and Numeral */}
                  <div className="flex items-center justify-between">
                    <span
                      style={{ transform: "translateZ(30px)" }}
                      className="grid size-14 place-items-center rounded-2xl bg-[var(--main)]/15 text-[var(--main)] border border-[var(--main)]/30 shadow-sm transition-colors duration-300 group-hover:bg-[var(--main)] group-hover:text-background"
                    >
                      <item.icon className="size-7" />
                    </span>
                    <span className="font-heading text-4xl sm:text-5xl font-extrabold text-foreground/15 dark:text-foreground/20 font-mono">
                      {item.num}
                    </span>
                  </div>

                  {/* Body Content */}
                  <div
                    style={{ transform: "translateZ(20px)" }}
                    className="mt-auto flex flex-col gap-2.5 pt-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-6 rounded-full bg-[var(--main)]/70" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--main)]">
                        {idx === 0
                          ? `01 / ${t("activities.categorySpiritual")}`
                          : idx === 1
                            ? `02 / ${t("activities.categorySocial")}`
                            : `03 / ${t("activities.categoryIntellectual")}`}
                      </span>
                    </div>
                    <h3 className="font-heading text-2xl font-bold tracking-tight">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t(item.descKey)}
                    </p>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
