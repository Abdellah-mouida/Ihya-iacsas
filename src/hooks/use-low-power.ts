"use client";

import { useEffect, useState } from "react";

type NetworkInformation = { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
type NavigatorWithHints = Navigator & { deviceMemory?: number; connection?: NetworkInformation };

export type UseLowPowerOptions = {
  /** Include touch-only devices as low power for cursor or pointer effects. */
  pointerOnly?: boolean;
};

function readLowPower(pointerOnly: boolean): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;

  const nav = navigator as NavigatorWithHints;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const noHover = pointerOnly && (window.matchMedia?.("(hover: none)").matches ?? false);

  return Boolean(
    reducedMotion ||
      nav.connection?.saveData ||
      (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
      (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) ||
      noHover,
  );
}

/** Conservatively disables optional effects until device capabilities are known. */
export function useLowPower({ pointerOnly = false }: UseLowPowerOptions = {}): boolean {
  const [lowPower, setLowPower] = useState(true);

  useEffect(() => {
    const update = () => setLowPower(readLowPower(pointerOnly));
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const hover = pointerOnly ? window.matchMedia?.("(hover: none)") : undefined;
    const connection = (navigator as NavigatorWithHints).connection;

    update();
    motion?.addEventListener?.("change", update);
    hover?.addEventListener?.("change", update);
    connection?.addEventListener?.("change", update);

    return () => {
      motion?.removeEventListener?.("change", update);
      hover?.removeEventListener?.("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, [pointerOnly]);

  return lowPower;
}
