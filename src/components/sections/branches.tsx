"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useState } from "react";

import { MoroccoMap } from "@/components/common/morocco-map";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { BRANCHES } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function Branches() {
  const { t } = useLocale();
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <section id="branches" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-40" />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("branches.kicker")}
          title={t("branches.title")}
          desc={t("branches.desc")}
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Interactive map */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <MoroccoMap activeId={activeId} onActivate={setActiveId} />
          </motion.div>

          {/* Branch legend (cross-highlights with the map) */}
          <div>
            <motion.ul
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="flex flex-col gap-3"
            >
              {BRANCHES.map((branch, i) => {
                const active = activeId === branch.id;
                return (
                  <motion.li key={branch.id} variants={fadeUp}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveId(branch.id)}
                      onMouseLeave={() => setActiveId(null)}
                      onFocus={() => setActiveId(branch.id)}
                      onBlur={() => setActiveId(null)}
                      onClick={() =>
                        setActiveId(active ? null : branch.id)
                      }
                      aria-pressed={active}
                      className={cn(
                        "group flex w-full items-center gap-4 rounded-2xl border p-4 text-start transition-all duration-300",
                        active
                          ? "glass-strong glow-gold -translate-y-0.5 border-brass/40"
                          : "glass border-border/60 hover:-translate-y-0.5 hover:border-brass/30",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-xl ring-1 transition-colors",
                          active
                            ? "bg-brass-gradient text-night ring-transparent"
                            : "bg-gradient-to-br from-gold/20 to-emerald/15 text-brass ring-brass/25",
                        )}
                      >
                        <MapPin className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="font-heading text-lg font-semibold leading-tight">
                          {t(branch.nameKey)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {t(branch.regionKey)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "ms-auto font-heading text-sm font-semibold tabular-nums transition-colors",
                          active ? "text-brass" : "text-muted-foreground/60",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={viewportOnce}
              className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
            >
              <MapPin className="size-4 text-brass" />
              {t("branches.mapHint")}
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}
