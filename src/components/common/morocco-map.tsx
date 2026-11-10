"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { MOROCCO_MAP } from "@/lib/morocco-map";
import { MOROCCO_MAP_BOUNDS, project, unproject } from "@/lib/morocco-projection";
import { EASE } from "@/lib/motion";
import type { PublicBranch } from "@/lib/branches/types";
import { spreadBranchMarkers } from "@/lib/branch-marker-layout";
import { cn } from "@/lib/utils";

const W = MOROCCO_MAP.width;
const H = MOROCCO_MAP.height;

export type MapBranch = PublicBranch & { name: string; regionName: string };

type MoroccoMapProps = {
  branches?: MapBranch[];
  activeId?: string | null;
  onActivate?: (id: string | null) => void;
  focusRegionId?: string | null;
  editor?: boolean;
  pin?: { latitude: number; longitude: number } | null;
  onPinChange?: (latitude: number, longitude: number) => void;
  ariaLabel?: string;
  className?: string;
};



export function MoroccoMap({
  branches = [],
  activeId = null,
  onActivate = () => {},
  focusRegionId = null,
  editor = false,
  pin = null,
  onPinChange,
  ariaLabel,
  className,
}: MoroccoMapProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  const mapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const markers = useMemo(() => spreadBranchMarkers(branches), [branches]);

  const focusPoints = focusRegionId
    ? branches.filter((branch) => branch.regionId === focusRegionId).map((branch) => project(branch.latitude, branch.longitude))
    : [];
  const focusCenter = focusPoints.length
    ? {
        x: (Math.min(...focusPoints.map((point) => point.x)) + Math.max(...focusPoints.map((point) => point.x))) / 2,
        y: (Math.min(...focusPoints.map((point) => point.y)) + Math.max(...focusPoints.map((point) => point.y))) / 2,
      }
    : { x: W / 2, y: H / 2 };
  const spreadX = focusPoints.length ? Math.max(120, Math.max(...focusPoints.map((point) => point.x)) - Math.min(...focusPoints.map((point) => point.x))) : W;
  const spreadY = focusPoints.length ? Math.max(150, Math.max(...focusPoints.map((point) => point.y)) - Math.min(...focusPoints.map((point) => point.y))) : H;
  const zoom = focusPoints.length ? Math.max(1, Math.min(3.2, W / (spreadX + 180), H / (spreadY + 220))) : 1;
  const transformOrigin = `${(focusCenter.x / W) * 100}% ${(focusCenter.y / H) * 100}%`;

  const placePin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editor || !onPinChange || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * MOROCCO_MAP_BOUNDS.width;
    const y = ((event.clientY - rect.top) / rect.height) * MOROCCO_MAP_BOUNDS.height;
    const geo = unproject(x, y);
    onPinChange(geo.latitude, geo.longitude);
  };

  return (
    <div
      ref={mapRef}
      className={cn("relative mx-auto w-full max-w-[26rem] touch-none", editor && "max-w-none cursor-crosshair", className)}
      onPointerDown={(event) => {
        if (!editor) return;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        placePin(event);
      }}
      onPointerMove={(event) => { if (editor && dragging && event.buttons !== 0) placePin(event); }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="relative aspect-[1000/1065] w-full overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `scale(${focusPoints.length && !editor ? zoom : 1})`, transformOrigin }}
        >
          <svg
            viewBox={MOROCCO_MAP.viewBox}
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label={ariaLabel ?? t("branches.title")}
          >
            <defs>
              <linearGradient id="mm-land" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="640" y2="1065">
                <stop offset="0" stopColor="var(--main)" stopOpacity="0.5" />
                <stop offset="0.55" stopColor="color-mix(in oklch, var(--main) 70%, var(--background))" stopOpacity="0.5" />
                <stop offset="1" stopColor="var(--background)" stopOpacity="0.75" />
              </linearGradient>
              <linearGradient id="mm-rim" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="1065">
                <stop offset="0" stopColor="var(--main)" />
                <stop offset="1" stopColor="color-mix(in oklch, var(--main) 60%, var(--gold))" />
              </linearGradient>
              <filter id="mm-soft" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="10" /></filter>
              <filter id="mm-rimglow" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="2.4" /></filter>
            </defs>
            <g filter="url(#mm-soft)" opacity="0.45">{MOROCCO_MAP.paths.map((path, index) => <path key={`soft-${index}`} d={path} fill="url(#mm-rim)" />)}</g>
            <g filter="url(#mm-rimglow)" opacity="0.85">{MOROCCO_MAP.paths.map((path, index) => <path key={`rim-${index}`} d={path} fill="url(#mm-rim)" />)}</g>
            <g>{MOROCCO_MAP.paths.map((path, index) => <path key={`land-${index}`} d={path} fill="url(#mm-land)" />)}</g>
          </svg>

          {editor && pin && (
            <button
              type="button"
              data-editor-pin
              aria-label={ariaLabel ?? t("adminBranches.mapLabel")}
              style={{ left: `${(project(pin.latitude, pin.longitude).x / W) * 100}%`, top: `${(project(pin.latitude, pin.longitude).y / H) * 100}%` }}
              className="absolute z-30 grid size-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full bg-background/80 text-[var(--main)] shadow-lg ring-2 ring-[var(--main)] active:cursor-grabbing"
            >
              <span className="size-3 rounded-full bg-[var(--main)]" />
            </button>
          )}

          {!editor && markers.map(({ branch, point }, index) => {
            const active = activeId === branch.id;
            return (
              <motion.button
                key={branch.id}
                type="button"
                initial={reducedMotion ? false : { opacity: 0, scale: 0, y: -12 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={reducedMotion ? { duration: 0 } : { delay: 0.1 + Math.min(index, 12) * 0.03, type: "spring", stiffness: 260, damping: 16 }}
                onMouseEnter={() => onActivate(branch.id)}
                onMouseLeave={() => onActivate(null)}
                onFocus={() => onActivate(branch.id)}
                onBlur={() => onActivate(null)}
                onClick={() => onActivate(active ? null : branch.id)}
                aria-label={`${branch.name} — ${branch.regionName}`}
                aria-pressed={active}
                style={{ left: `${(point.x / W) * 100}%`, top: `${(point.y / H) * 100}%` }}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none", "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent", active ? "z-30" : "z-10")}
              >
                <span aria-hidden className={cn("absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--main)]/30", !reducedMotion && "animate-pulse-ring")} />
                <span aria-hidden className={cn("relative block size-2.5 rounded-full ring-2 ring-background bg-[var(--main)]", active && "shadow-[0_0_0_4px_color-mix(in_oklch,var(--main)_40%,transparent),0_6px_16px_color-mix(in_oklch,var(--main)_50%,transparent)]")} />
                <AnimatePresence>
                  {active && (
                    <motion.span
                      initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.92 }}
                      transition={{ duration: reducedMotion ? 0 : 0.2, ease: EASE }}
                      className="glass-strong pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-xl px-3 py-2 shadow-layered"
                    >
                      <span className="font-heading text-sm font-semibold leading-tight text-foreground">{branch.name}</span>
                      <span className="text-[0.7rem] leading-tight text-muted-foreground">{branch.regionName}</span>
                      <span aria-hidden className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-[var(--card)]" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
