"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import { staggerContainer, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { OrnamentDivider } from "./ornament-divider";

const headingReveal: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
};

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
      variants={staggerContainer(0.04, 0.02)}
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
          variants={headingReveal}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brass"
        >
          <span className="size-1.5 rounded-full bg-brass" />
          {kicker}
        </motion.span>
      ) : null}

      <motion.h2
        variants={headingReveal}
        className="font-heading text-3xl font-semibold text-balance sm:text-4xl md:text-5xl"
      >
        {title}
      </motion.h2>

      {desc ? (
        <motion.p
          variants={headingReveal}
          className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {desc}
        </motion.p>
      ) : null}

      {divider ? (
        <motion.div variants={headingReveal}>
          <OrnamentDivider className={align === "center" ? "mx-auto" : ""} />
        </motion.div>
      ) : null}
    </motion.div>
  );
}
