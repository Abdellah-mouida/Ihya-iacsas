"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { InViewReveal } from "./in-view-reveal";
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
    <InViewReveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-start",
        className,
      )}
    >
      {kicker ? (
        <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          <span className="size-1.5 rounded-full bg-brass" />
          {kicker}
        </span>
      ) : null}

      <h2 className="font-heading text-3xl font-semibold text-balance sm:text-4xl md:text-5xl">
        {title}
      </h2>

      {desc ? (
        <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {desc}
        </p>
      ) : null}

      {divider ? (
        <div>
          <OrnamentDivider className={align === "center" ? "mx-auto" : ""} />
        </div>
      ) : null}
    </InViewReveal>
  );
}
