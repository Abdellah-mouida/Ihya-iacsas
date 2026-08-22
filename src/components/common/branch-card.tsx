"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { fadeUp } from "@/lib/motion";
import { MotionCard } from "./motion-card";

export function BranchCard({
  nameKey,
  index,
}: {
  nameKey: string;
  index: number;
}) {
  const { t } = useLocale();

  return (
    <motion.div variants={fadeUp} className="group h-full">
      <MotionCard intensity={12} className="h-full" glare>
        <div className="glass-strong preserve-3d relative flex h-full flex-col items-center gap-4 overflow-hidden rounded-3xl p-8 text-center shadow-layered">
          {/* soft brand glow */}
          <div className="bg-brass-gradient absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />

          {/* floating medallion */}
          <div
            style={{
              transform: "translateZ(45px)",
              animationDelay: `${index * 0.4}s`,
            }}
            className="relative grid size-16 animate-float place-items-center rounded-2xl bg-gradient-to-br from-gold/25 to-emerald/20 text-brass ring-1 ring-brass/30"
          >
            <MapPin className="size-7" />
          </div>

          <div
            style={{ transform: "translateZ(24px)" }}
            className="flex flex-col gap-1"
          >
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {t("branches.cardLabel")}
            </span>
            <span className="font-heading text-2xl font-semibold">
              {t(nameKey)}
            </span>
          </div>

          <span className="rule-gold mt-1 h-px w-12" />
        </div>
      </MotionCard>
    </motion.div>
  );
}
