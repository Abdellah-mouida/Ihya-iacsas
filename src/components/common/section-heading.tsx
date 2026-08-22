"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { OrnamentDivider } from "./ornament-divider";

export function SectionHeading({
  kicker,
  title,
  desc,
  align = "center",
  divider = true,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  align?: "center" | "start";
  divider?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer(0.12)}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-start",
        className,
      )}
    >
      {kicker ? (
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass"
        >
          <span className="size-1.5 rounded-full bg-brass" />
          {kicker}
        </motion.span>
      ) : null}

      <motion.h2
        variants={fadeUp}
        className="font-heading text-3xl font-semibold text-balance sm:text-4xl md:text-5xl"
      >
        {title}
      </motion.h2>

      {desc ? (
        <motion.p
          variants={fadeUp}
          className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {desc}
        </motion.p>
      ) : null}

      {divider ? (
        <motion.div variants={fadeUp}>
          <OrnamentDivider className={align === "center" ? "mx-auto" : ""} />
        </motion.div>
      ) : null}
    </motion.div>
  );
}
