"use client";

import { useCallback, useSyncExternalStore } from "react";

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

const subscribers: [Set<() => void>, Set<() => void>] = [new Set(), new Set()];
const currentValues: [boolean, boolean] = [true, true];
let mediaCleanup: (() => void) | null = null;

function notifyCapabilityChange() {
  for (const pointerOnly of [false, true] as const) {
    const index = Number(pointerOnly) as 0 | 1;
    const next = readLowPower(pointerOnly);
    if (next === currentValues[index]) continue;
    currentValues[index] = next;
    for (const subscriber of subscribers[index]) subscriber();
  }
}

function subscribeToCapabilities(pointerOnly: boolean, subscriber: () => void) {
  const index = Number(pointerOnly) as 0 | 1;
  subscribers[index].add(subscriber);

  if (!mediaCleanup && typeof window !== "undefined") {
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const hover = window.matchMedia?.("(hover: none)");
    const connection = (navigator as NavigatorWithHints).connection;
    const update = () => notifyCapabilityChange();

    motion?.addEventListener?.("change", update);
    hover?.addEventListener?.("change", update);
    connection?.addEventListener?.("change", update);
    mediaCleanup = () => {
      motion?.removeEventListener?.("change", update);
      hover?.removeEventListener?.("change", update);
      connection?.removeEventListener?.("change", update);
      mediaCleanup = null;
    };
    notifyCapabilityChange();
  }

  return () => {
    subscribers[index].delete(subscriber);
    if (!subscribers[0].size && !subscribers[1].size) mediaCleanup?.();
  };
}

/** Conservatively disables optional effects until device capabilities are known. */
export function useLowPower({ pointerOnly = false }: UseLowPowerOptions = {}): boolean {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToCapabilities(pointerOnly, listener),
    [pointerOnly],
  );
  const getSnapshot = useCallback(() => currentValues[Number(pointerOnly) as 0 | 1], [pointerOnly]);

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
