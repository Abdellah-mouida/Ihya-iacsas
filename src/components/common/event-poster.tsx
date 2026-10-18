"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { Maximize2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type PointerEvent } from "react";

import { EventFlyerDialog } from "@/components/common/event-flyer-dialog";
import { cn } from "@/lib/utils";

export function EventPoster({
  src,
  alt,
  badge,
  className,
  title,
  dateStr,
  locationStr,
}: {
  src: string;
  alt: string;
  badge?: string;
  className?: string;
  title?: string;
  dateStr?: string;
  locationStr?: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [16, -16]), {
    stiffness: 150,
    damping: 14,
  });
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), {
    stiffness: 150,
    damping: 14,
  });

  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.4), transparent 55%)`;

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
    <div className={cn("perspective-1200", className)}>
      <motion.div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="group relative mx-auto w-full max-w-sm"
      >
        {/* Ambient gradient glow */}
        <div className="bg-brass-gradient absolute -inset-6 -z-10 rounded-[2.5rem] opacity-30 blur-3xl animate-float-slow" />

        {/* Poster frame */}
        <div
          data-testid="event-poster-frame"
          onClick={() => setIsDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsDialogOpen(true);
            }
          }}
          className="relative cursor-pointer overflow-hidden rounded-[1.75rem] shadow-layered ring-1 ring-brass/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
          style={{ transform: "translateZ(0)" }}
        >
          <Image
            src={src}
            alt={alt}
            width={512}
            height={640}
            sizes="(max-width: 640px) 90vw, 384px"
            className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          {/* Warm overlay + gold inner frame */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/40 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-2.5 rounded-[1.4rem] ring-1 ring-inset ring-gold/40" />

          {/* Quick view button hint on hover */}
          <div className="absolute inset-x-0 bottom-3 flex justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <span className="glass-strong inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-brass shadow-lg backdrop-blur-md">
              <Maximize2 className="size-3.5" />
              <span>{title ? "عرض الملصق" : "View Flyer"}</span>
            </span>
          </div>

          <motion.div
            aria-hidden
            style={{ background: glare }}
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
          />
        </div>

        {/* Floating badge with real depth */}
        {badge ? (
          <div
            style={{ transform: "translateZ(70px)" }}
            className="glass-strong absolute -top-4 start-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-brass shadow-layered"
          >
            <span className="size-2 animate-pulse rounded-full bg-brass" />
            {badge}
          </div>
        ) : null}
      </motion.div>

      {/* Full-res Flyer Dialog */}
      <EventFlyerDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        posterUrl={src}
        title={title || alt}
        dateStr={dateStr}
        locationStr={locationStr}
      />
    </div>
  );
}
