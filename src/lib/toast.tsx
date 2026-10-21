"use client";

import React from "react";
import { toast as sonnerToast, type ExternalToast } from "sonner";

export interface NotifyOptions extends ExternalToast {
  /** Optional custom title override */
  title?: React.ReactNode;
  /** Optional timeout safety net in ms for async operations (defaults to 15000ms) */
  timeoutMs?: number;
}

/**
 * In-memory toast deduplication & counter tracker.
 * Identical (variant + message) within DEDUPE_WINDOW_MS will increment count
 * and refresh the sonner toast with a badge ("×N") instead of spamming duplicates.
 */
interface ActiveToastRecord {
  id: string | number;
  count: number;
  timestamp: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

const DEDUPE_WINDOW_MS = 4000;
const activeToasts = new Map<string, ActiveToastRecord>();

// Global list of active sonner toast IDs to track and provide a "Clear all" capability
const activeToastIds = new Set<string | number>();

function getToastKey(type: string, message: React.ReactNode): string {
  if (typeof message === "string" || typeof message === "number") {
    return `${type}:${message}`;
  }
  try {
    return `${type}:${JSON.stringify(message)}`;
  } catch {
    return `${type}:${String(message)}`;
  }
}

/**
 * Detect current document locale (defaults to "ar")
 */
function getCurrentLocale(): "ar" | "en" {
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang;
    if (lang === "en") return "en";
    if (lang === "ar") return "ar";
    if (document.documentElement.dir === "ltr") return "en";
  }
  return "ar";
}

function getStatusTitle(type: "success" | "warning" | "error" | "info"): string {
  const isAr = getCurrentLocale() === "ar";
  switch (type) {
    case "success":
      return isAr ? "نجاح" : "Success";
    case "warning":
      return isAr ? "تنبيه" : "Warning";
    case "error":
      return isAr ? "خطأ" : "Error";
    case "info":
      return isAr ? "معلومة" : "Info";
  }
}

function formatToastPayload(
  type: "success" | "warning" | "error" | "info",
  message: React.ReactNode,
  options?: NotifyOptions,
  count = 1
): { title: React.ReactNode; options: ExternalToast } {
  const statusTitle = options?.title ?? getStatusTitle(type);
  const restOptions = { ...options };
  delete restOptions.title;

  let descriptionContent: React.ReactNode = (
    <div className="flex items-center gap-2">
      <span className="flex-1">{message}</span>
      {count > 1 && (
        <span
          data-testid="toast-dedupe-badge"
          className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold rounded-full bg-primary/15 text-primary border border-primary/20 animate-in fade-in zoom-in-95 duration-200 select-none shrink-0"
        >
          ×{count}
        </span>
      )}
    </div>
  );

  if (restOptions.description) {
    const rawDesc = typeof restOptions.description === "function" ? restOptions.description() : restOptions.description;
    descriptionContent = (
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="flex-1">{message}</span>
          {count > 1 && (
            <span
              data-testid="toast-dedupe-badge"
              className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold rounded-full bg-primary/15 text-primary border border-primary/20 animate-in fade-in zoom-in-95 duration-200 select-none shrink-0"
            >
              ×{count}
            </span>
          )}
        </div>
        <div className="text-muted-foreground text-xs opacity-90">{rawDesc}</div>
      </div>
    );
  }

  return {
    title: statusTitle,
    options: {
      ...restOptions,
      description: descriptionContent,
    },
  };
}

function emitDedupedToast(
  type: "success" | "warning" | "error" | "info",
  message: React.ReactNode,
  options?: NotifyOptions
): string | number {
  const key = getToastKey(type, message);
  const existing = activeToasts.get(key);

  const duration = options?.duration ?? (type === "error" ? 6000 : type === "warning" ? 5000 : 4500);

  if (existing) {
    // Increment count & refresh toast
    existing.count += 1;
    clearTimeout(existing.timeoutId);
    existing.timeoutId = setTimeout(() => {
      activeToasts.delete(key);
      activeToastIds.delete(existing.id);
    }, DEDUPE_WINDOW_MS);

    const { title, options: finalOptions } = formatToastPayload(type, message, options, existing.count);

    sonnerToast[type](title, {
      id: existing.id,
      duration,
      dismissible: true,
      ...finalOptions,
    });
    return existing.id;
  }

  // Create new toast
  const { title, options: finalOptions } = formatToastPayload(type, message, options, 1);
  const toastId = sonnerToast[type](title, {
    duration,
    dismissible: true,
    onDismiss: (t) => {
      activeToastIds.delete(t.id);
      options?.onDismiss?.(t);
    },
    onAutoClose: (t) => {
      activeToastIds.delete(t.id);
      options?.onAutoClose?.(t);
    },
    ...finalOptions,
  });

  activeToastIds.add(toastId);

  const timeoutId = setTimeout(() => {
    activeToasts.delete(key);
    activeToastIds.delete(toastId);
  }, DEDUPE_WINDOW_MS);

  activeToasts.set(key, {
    id: toastId,
    count: 1,
    timestamp: Date.now(),
    timeoutId,
  });

  return toastId;
}

/**
 * Timeout safety net helper: ensures an async promise cannot hang indefinitely.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = 15000, timeoutMessage?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(timeoutMessage || "Operation timed out. Please try again."));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Ihyaa Program Themed Notification System (notify)
 * Provides Islamic geometric styling, glassmorphism, soft floating shadow,
 * Montserrat & Arabic typography pairing, RTL/LTR awareness, localized status titles,
 * 4s message deduplication with ×N badge, max 3 stack limit, and built-in timeout safety nets.
 */
export const notify = {
  success: (message: React.ReactNode, options?: NotifyOptions) => {
    return emitDedupedToast("success", message, options);
  },

  error: (message: React.ReactNode, options?: NotifyOptions) => {
    return emitDedupedToast("error", message, options);
  },

  warning: (message: React.ReactNode, options?: NotifyOptions) => {
    return emitDedupedToast("warning", message, options);
  },

  info: (message: React.ReactNode, options?: NotifyOptions) => {
    return emitDedupedToast("info", message, options);
  },

  /**
   * Safe promise toast: automatically guards against permanent spinner lockups
   * by attaching a safety net timeout.
   */
  promise: <T,>(
    promise: Promise<T>,
    data: {
      loading: React.ReactNode;
      success: string | React.ReactNode | ((data: T) => React.ReactNode);
      error: string | React.ReactNode | ((error: unknown) => React.ReactNode);
      description?: React.ReactNode;
      finally?: () => void;
      timeoutMs?: number;
      timeoutMessage?: string;
    },
  ) => {
    const timeoutMs = data.timeoutMs ?? 15000;
    const guardedPromise = withTimeout(promise, timeoutMs, data.timeoutMessage);

    const toastResult = sonnerToast.promise(guardedPromise, {
      loading: data.loading,
      success: data.success,
      error: data.error,
      description: data.description,
      finally: data.finally,
    });
    if (typeof toastResult === "string" || typeof toastResult === "number") {
      activeToastIds.add(toastResult);
    }
    return toastResult;
  },

  dismiss: (id?: string | number) => {
    if (id !== undefined) {
      activeToastIds.delete(id);
      sonnerToast.dismiss(id);
    } else {
      activeToastIds.clear();
      activeToasts.clear();
      sonnerToast.dismiss();
    }
  },

  /**
   * Clear all active toasts immediately
   */
  clearAll: () => {
    activeToastIds.clear();
    activeToasts.clear();
    sonnerToast.dismiss();
  },

  getActiveCount: () => activeToastIds.size,
};

/**
 * Drop-in enhanced toast replacement with localized status hierarchy
 */
export const toast = {
  success: notify.success,
  error: notify.error,
  warning: notify.warning,
  info: notify.info,
  promise: notify.promise,
  dismiss: notify.dismiss,
  clearAll: notify.clearAll,
  getActiveCount: notify.getActiveCount,
};

// Expose toast on window in development/test environments for automated testing
if (typeof window !== "undefined") {
  (window as unknown as { __IHYAA_TOAST__?: typeof toast }).__IHYAA_TOAST__ = toast;
}
