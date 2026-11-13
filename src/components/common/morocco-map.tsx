"use client";

import { motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  editorInteractive?: boolean;
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
  editorInteractive = true,
  pin = null,
  onPinChange,
  ariaLabel,
  className,
}: MoroccoMapProps) {
  const { t } = useLocale();
  const reducedMotion = useReducedMotion();
  const mapRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
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
  const activeBranch = !editor && activeId ? markers.find(({ branch }) => branch.id === activeId) ?? null : null;

  useLayoutEffect(() => {
    if (!activeBranch) return;
    const placeTooltip = () => {
      const tooltip = tooltipRef.current;
      const map = mapRef.current;
      const section = map?.closest<HTMLElement>("#branches");
      const marker = activeId && map
        ? [...map.querySelectorAll<HTMLButtonElement>("[data-branch-marker]")].find((node) => node.dataset.branchMarker === activeId)
        : null;
      if (!tooltip || !marker || !section) return;
      const markerRect = marker.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const inset = 8;
      const minLeft = sectionRect.left + inset;
      const maxLeft = Math.max(minLeft, sectionRect.right - tooltipWidth - inset);
      const left = Math.min(maxLeft, Math.max(minLeft, markerRect.left + markerRect.width / 2 - tooltipWidth / 2));
      let top = markerRect.top - tooltipHeight - 10;
      if (top < sectionRect.top + inset) top = markerRect.bottom + 10;
      const minTop = sectionRect.top + inset;
      const maxTop = Math.max(minTop, sectionRect.bottom - tooltipHeight - inset);
      top = Math.min(maxTop, Math.max(minTop, top));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };

    placeTooltip();
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    const section = mapRef.current?.closest<HTMLElement>("#branches");
    const zoomLayer = mapRef.current?.firstElementChild;
    zoomLayer?.addEventListener("transitionend", placeTooltip);
    const observer = section && typeof ResizeObserver !== "undefined" ? new ResizeObserver(placeTooltip) : null;
    if (section) observer?.observe(section);
    return () => {
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
      zoomLayer?.removeEventListener("transitionend", placeTooltip);
      observer?.disconnect();
    };
  }, [activeBranch, activeId]);

  const placePin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editor || !onPinChange || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * MOROCCO_MAP_BOUNDS.width;
    const y = ((event.clientY - rect.top) / rect.height) * MOROCCO_MAP_BOUNDS.height;
    const geo = unproject(x, y);
    onPinChange(geo.latitude, geo.longitude);
  };

  return (
    <>
    <div
      ref={mapRef}
      className={cn("relative mx-auto w-full max-w-[26rem] [contain:layout_style]", editor && "max-w-none touch-none", editor && editorInteractive && "cursor-crosshair", className)}
      onPointerDown={(event) => {
        if (!editor || !editorInteractive) return;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        placePin(event);
      }}
      onPointerMove={(event) => { if (editor && editorInteractive && dragging && event.buttons !== 0) placePin(event); }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      <div className="relative aspect-[1000/1065] w-full overflow-visible">
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
            <g className="mm-glow-layer" filter="url(#mm-soft)" opacity="0.45">{MOROCCO_MAP.paths.map((path, index) => <path key={`soft-${index}`} d={path} fill="url(#mm-rim)" />)}</g>
            <g className="mm-glow-layer" filter="url(#mm-rimglow)" opacity="0.85">{MOROCCO_MAP.paths.map((path, index) => <path key={`rim-${index}`} d={path} fill="url(#mm-rim)" />)}</g>
            <g>{MOROCCO_MAP.paths.map((path, index) => <path key={`land-${index}`} d={path} fill="url(#mm-land)" />)}</g>
          </svg>

          {editor && pin && (
            <button
              type="button"
              disabled={!editorInteractive}
              data-editor-pin
              aria-label={ariaLabel ?? t("adminBranches.mapLabel")}
              style={{ left: `${(project(pin.latitude, pin.longitude).x / W) * 100}%`, top: `${(project(pin.latitude, pin.longitude).y / H) * 100}%` }}
              className={cn("absolute z-30 grid size-10 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full bg-background/80 text-[var(--main)] shadow-lg ring-2 ring-[var(--main)]", editorInteractive ? "cursor-grab active:cursor-grabbing" : "cursor-default")}
            >
              <span className="size-3 rounded-full bg-[var(--main)]" />
            </button>
          )}

          {!editor && markers.map(({ branch, point }) => {
            const active = activeId === branch.id;
            return (
              <button
                key={branch.id}
                type="button"
                onMouseEnter={() => onActivate(branch.id)}
                onMouseLeave={() => onActivate(null)}
                onFocus={() => onActivate(branch.id)}
                onBlur={() => onActivate(null)}
                onClick={() => onActivate(active ? null : branch.id)}
                aria-label={`${branch.name} — ${branch.regionName}`}
                aria-pressed={active}
                data-branch-marker={branch.id}
                style={{ left: `${(point.x / W) * 100}%`, top: `${(point.y / H) * 100}%` }}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none", "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent", active ? "z-30" : "z-10")}
              >
                {active && <span aria-hidden data-testid="branch-marker-pulse" className={cn("absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color-mix(in_oklch,var(--foreground)_26%,transparent)]", !reducedMotion && "animate-pulse-ring")} />}
                <span aria-hidden data-testid="branch-marker-dot" className={cn("relative block size-2.5 rounded-full ring-2 ring-background transition-transform duration-200", active ? "scale-125 bg-[var(--foreground)]" : "bg-[var(--main)]")} />

              </button>
            );
          })}
        </div>
      </div>
    </div>
    {activeBranch && typeof document !== "undefined" && createPortal(
      <motion.span
        ref={tooltipRef}
        initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, ease: EASE }}
        data-testid="branch-map-tooltip"
        aria-hidden="true"
        className="glass-strong pointer-events-none fixed z-[100] flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-xl px-3 py-2 shadow-layered"
        style={{ left: 0, top: 0 }}
      >
        <span className="font-heading text-sm font-semibold leading-tight text-foreground">{activeBranch.branch.name}</span>
        <span className="text-[0.7rem] leading-tight text-muted-foreground">{activeBranch.branch.regionName}</span>
        <span aria-hidden className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-[var(--card)]" />
      </motion.span>,
      document.body,
    )}
    </>
  );
}
