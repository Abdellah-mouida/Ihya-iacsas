"use client";

import { useCallback, useSyncExternalStore } from "react";

type NetworkInformation = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};
type NavigatorWithHints = Navigator & { deviceMemory?: number; connection?: NetworkInformation };

export type UseLowPowerOptions = {
  /** Include touch-only devices as low power for cursor or pointer effects. */
  pointerOnly?: boolean;
};

let samplerCleanup: (() => void) | null = null;
let samplerDone = false;

function readDeviceLowPower(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const nav = navigator as NavigatorWithHints;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return Boolean(
    reducedMotion ||
      nav.connection?.saveData ||
      (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) ||
      (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4),
  );
}

function readLowPower(pointerOnly: boolean): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return true;
  const perfLow = document.documentElement.getAttribute("data-perf") === "low";
  const noHover = pointerOnly && (window.matchMedia?.("(hover: none)").matches ?? false);
  return Boolean(perfLow || readDeviceLowPower() || noHover);
}

const subscribers: [Set<() => void>, Set<() => void>] = [new Set(), new Set()];
const currentValues: [boolean, boolean] = [true, true];
let mediaCleanup: (() => void) | null = null;

function syncPerfAttribute() {
  if (typeof document === "undefined") return;
  if (readDeviceLowPower() && document.documentElement.getAttribute("data-perf") !== "low") {
    document.documentElement.setAttribute("data-perf", "low");
  }
}

function notifyCapabilityChange() {
  syncPerfAttribute();
  for (const pointerOnly of [false, true] as const) {
    const index = Number(pointerOnly) as 0 | 1;
    const next = readLowPower(pointerOnly);
    if (next === currentValues[index]) continue;
    currentValues[index] = next;
    for (const subscriber of subscribers[index]) subscriber();
  }
}

function startScrollFrameSampler() {
  if (samplerDone || samplerCleanup || typeof window === "undefined") return;
  if (document.documentElement.getAttribute("data-perf") === "low" || readDeviceLowPower()) {
    samplerDone = true;
    return;
  }

  let rafId = 0;
  let idleTimer = 0;
  let lastTime = 0;
  let firstScrollAt = 0;
  let totalDelta = 0;
  let count = 0;
  let slowFrames = 0;
  let verySlowFrames = 0;

  const stopSampler = () => {
    samplerDone = true;
    window.removeEventListener("scroll", onScroll);
    if (rafId) cancelAnimationFrame(rafId);
    if (idleTimer) window.clearTimeout(idleTimer);
    rafId = 0;
    idleTimer = 0;
    samplerCleanup = null;
  };

  const sampleFrame = (now: number) => {
    rafId = 0;
    if (samplerDone) return;
    if (lastTime > 0) {
      const dt = now - lastTime;
      // Ignore tab switches or idle pauses between scroll bursts.
      if (dt < 450) {
        count += 1;
        totalDelta += dt;
        if (dt > 28) slowFrames += 1;
        if (dt > 55) verySlowFrames += 1;

        if (
          verySlowFrames >= 2 ||
          slowFrames >= 5 ||
          (count >= 10 && totalDelta / count > 24)
        ) {
          document.documentElement.setAttribute("data-perf", "low");
          stopSampler();
          notifyCapabilityChange();
          return;
        }
        if (count >= 20 || now - firstScrollAt > 4000) {
          stopSampler();
          return;
        }
      }
    }
    lastTime = now;
    rafId = requestAnimationFrame(sampleFrame);
  };

  const onScroll = () => {
    if (samplerDone) return;
    if (!firstScrollAt) firstScrollAt = performance.now();
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(sampleFrame);
    }
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;
    }, 120);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  samplerCleanup = () => {
    window.removeEventListener("scroll", onScroll);
    if (rafId) cancelAnimationFrame(rafId);
    if (idleTimer) window.clearTimeout(idleTimer);
    samplerCleanup = null;
  };
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
    startScrollFrameSampler();
    mediaCleanup = () => {
      motion?.removeEventListener?.("change", update);
      hover?.removeEventListener?.("change", update);
      connection?.removeEventListener?.("change", update);
      samplerCleanup?.();
      mediaCleanup = null;
    };
    notifyCapabilityChange();
  }

  return () => {
    subscribers[index].delete(subscriber);
    if (!subscribers[0].size && !subscribers[1].size) mediaCleanup?.();
  };
}

/** Adaptive quality hook: detects low-spec devices and slow initial scroll frames via `data-perf="low"`. */
export function useLowPower({ pointerOnly = false }: UseLowPowerOptions = {}): boolean {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToCapabilities(pointerOnly, listener),
    [pointerOnly],
  );
  const getSnapshot = useCallback(() => currentValues[Number(pointerOnly) as 0 | 1], [pointerOnly]);

  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
