"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPin } from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { BRANCHES } from "@/lib/content";
import { MOROCCO_MAP, type MoroccoPinId } from "@/lib/morocco-map";
import { EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

const W = MOROCCO_MAP.width;
const H = MOROCCO_MAP.height;

export function MoroccoMap({
  activeId,
  onActivate,
}: {
  activeId: string | null;
  onActivate: (id: string | null) => void;
}) {
  const { t } = useLocale();

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      <div className="relative aspect-[1000/1065] w-full">
        {/* Landmass */}
        <svg
          viewBox={MOROCCO_MAP.viewBox}
          className="absolute inset-0 h-full w-full overflow-visible"
          role="img"
          aria-label={t("branches.title")}
        >
          <defs>
            <linearGradient
              id="mm-land"
              gradientUnits="userSpaceOnUse"
              x1="150"
              y1="0"
              x2="640"
              y2="1065"
            >
              <stop
                offset="0"
                stopColor="var(--emerald)"
                stopOpacity="0.42"
              />
              <stop
                offset="0.55"
                stopColor="var(--emerald-deep)"
                stopOpacity="0.5"
              />
              <stop
                offset="1"
                stopColor="var(--night-deep)"
                stopOpacity="0.55"
              />
            </linearGradient>
            <linearGradient
              id="mm-rim"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="1000"
              y2="1065"
            >
              <stop offset="0" stopColor="var(--gold)" />
              <stop offset="1" stopColor="var(--brass)" />
            </linearGradient>
            {/* Halos built from the UNION alpha of the group, so the internal
                Morocco / Southern-Provinces border never shows. */}
            <filter id="mm-soft" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="10" />
            </filter>
            <filter id="mm-rimglow" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>

          {/* soft outer halo */}
          <g filter="url(#mm-soft)" opacity="0.45">
            {MOROCCO_MAP.paths.map((d, i) => (
              <path key={`soft-${i}`} d={d} fill="url(#mm-rim)" />
            ))}
          </g>
          {/* tight rim glow (near-crisp gold edge, still seamless) */}
          <g filter="url(#mm-rimglow)" opacity="0.85">
            {MOROCCO_MAP.paths.map((d, i) => (
              <path key={`rim-${i}`} d={d} fill="url(#mm-rim)" />
            ))}
          </g>
          {/* land body */}
          <g>
            {MOROCCO_MAP.paths.map((d, i) => (
              <path key={`land-${i}`} d={d} fill="url(#mm-land)" />
            ))}
          </g>
        </svg>

        {/* Pins (HTML overlay for easy tooltips + text) */}
        {BRANCHES.map((branch, i) => {
          const pin = MOROCCO_MAP.pins[branch.id as MoroccoPinId];
          if (!pin) return null;
          const active = activeId === branch.id;
          return (
            <motion.button
              key={branch.id}
              type="button"
              initial={{ opacity: 0, scale: 0, y: -16 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{
                delay: 0.25 + i * 0.13,
                type: "spring",
                stiffness: 260,
                damping: 16,
              }}
              onMouseEnter={() => onActivate(branch.id)}
              onMouseLeave={() => onActivate(null)}
              onFocus={() => onActivate(branch.id)}
              onBlur={() => onActivate(null)}
              onClick={() => onActivate(active ? null : branch.id)}
              aria-label={`${t(branch.nameKey)} — ${t(branch.regionKey)}`}
              style={{
                left: `${(pin.x / W) * 100}%`,
                top: `${(pin.y / H) * 100}%`,
              }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none",
                "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                active ? "z-30" : "z-10",
              )}
            >
              {/* idle pulse ring */}
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full bg-gold/40"
                style={{ animationDelay: `${i * 0.7}s` }}
              />
              {/* marker dot */}
              <motion.span
                aria-hidden
                animate={{ scale: active ? 1.45 : 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className={cn(
                  "bg-brass-gradient relative block size-3.5 rounded-full ring-2 ring-background",
                  active
                    ? "shadow-[0_0_0_4px_color-mix(in_oklch,var(--gold)_35%,transparent),0_6px_16px_color-mix(in_oklch,var(--gold)_45%,transparent)]"
                    : "shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
                )}
              />

              {/* tooltip */}
              <AnimatePresence>
                {active && (
                  <motion.span
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.92 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="glass-strong pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-xl px-3 py-2 shadow-layered"
                  >
                    <span className="font-heading text-sm font-semibold leading-tight text-foreground">
                      {t(branch.nameKey)}
                    </span>
                    <span className="text-[0.7rem] leading-tight text-muted-foreground">
                      {t(branch.regionKey)}
                    </span>
                    <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-[var(--card)]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
