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
          {ACTIVITIES.map((item) => (
            <motion.div key={item.num} variants={fadeUp} className="group h-full">
              <MotionCard intensity={11} className="h-full">
                <div className="glass preserve-3d relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl p-8 text-foreground shadow-layered transition-[box-shadow,transform,border-color] duration-300 group-hover:-translate-y-1.5 group-hover:ring-1 group-hover:ring-brass/40 group-hover:shadow-layered dark:text-white dark:group-hover:shadow-[0_28px_70px_rgba(0,0,0,0.45)]">
                  {/* subtle girih texture inside the card */}
                  <div
                    aria-hidden
                    className="pattern-islamic pointer-events-none absolute inset-0 opacity-50"
                  />
                  {/* number watermark */}
                  <span className="pointer-events-none absolute -top-4 end-3 font-heading text-8xl font-bold text-foreground/[0.05] dark:text-white/5">
                    {item.num}
                  </span>
                  <div className="bg-brass-gradient absolute -right-10 -top-10 size-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />

                  <span
                    style={{ transform: "translateZ(40px)" }}
                    className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/25 dark:text-gold"
                  >
                    <item.icon className="size-7" />
                  </span>
                  <div
                    style={{ transform: "translateZ(24px)" }}
                    className="mt-auto flex flex-col gap-2"
                  >
                    <span className="text-sm font-semibold text-brass dark:text-gold">
                      {item.num}
                    </span>
                    <h3 className="font-heading text-2xl font-semibold">
                      {t(item.titleKey)}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground dark:text-white/70">
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
