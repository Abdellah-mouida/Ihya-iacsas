"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mouse-tracking 3D tilt card. Wraps children in a perspective container and
 * rotates on hover, with an optional light glare that follows the pointer.
 * `radiusClass` MUST match the inner card's radius so the glare and tilt stay
 * contained within the rounded corners (no square/border artifacts on hover).
 */
export function MotionCard({
  children,
  className,
  wrapperClassName,
  intensity = 9,
  glare = true,
  radiusClass = "rounded-3xl",
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  intensity?: number;
  glare?: boolean;
  radiusClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(py, [-0.5, 0.5], [intensity, -intensity]),
    { stiffness: 150, damping: 15 },
  );
  const rotateY = useSpring(
    useTransform(px, [-0.5, 0.5], [-intensity, intensity]),
    { stiffness: 150, damping: 15 },
  );

  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, color-mix(in oklch, var(--gold) 45%, transparent), transparent 55%)`;

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div className={cn("perspective-1200 h-full", wrapperClassName)}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={cn("relative h-full", radiusClass, className)}
      >
        {children}
        {glare ? (
          <motion.div
            aria-hidden
            style={{ background: glareBg }}
            className={cn(
              "pointer-events-none absolute inset-0 z-20 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100",
              radiusClass,
            )}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
