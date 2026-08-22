"use client";

import { motion } from "framer-motion";

import { BranchCard } from "@/components/common/branch-card";
import { SectionHeading } from "@/components/common/section-heading";
import { useLocale } from "@/i18n/locale-provider";
import { BRANCHES } from "@/lib/content";
import { staggerContainer, viewportOnce } from "@/lib/motion";

export function Branches() {
  const { t } = useLocale();

  return (
    <section id="branches" className="relative overflow-hidden py-24 sm:py-32">
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-40" />
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker={t("branches.kicker")}
          title={t("branches.title")}
          desc={t("branches.desc")}
        />

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {BRANCHES.map((branch, i) => (
            <BranchCard key={branch.id} nameKey={branch.nameKey} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
