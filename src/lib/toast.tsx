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
  options?: NotifyOptions
): { title: React.ReactNode; options: ExternalToast } {
  const statusTitle = options?.title ?? getStatusTitle(type);
  const restOptions = { ...options };
  delete restOptions.title;

  let descriptionContent: React.ReactNode = message;
  if (restOptions.description) {
    const rawDesc = typeof restOptions.description === "function" ? restOptions.description() : restOptions.description;
    descriptionContent = (
      <div className="space-y-0.5">
        <div>{message}</div>
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
 * and built-in timeout safety nets across all forms.
 */
export const notify = {
  success: (message: React.ReactNode, options?: NotifyOptions) => {
    const { title, options: finalOptions } = formatToastPayload("success", message, options);
    return sonnerToast.success(title, {
      duration: options?.duration ?? 4500,
      dismissible: true,
      ...finalOptions,
    });
  },

  error: (message: React.ReactNode, options?: NotifyOptions) => {
    const { title, options: finalOptions } = formatToastPayload("error", message, options);
    return sonnerToast.error(title, {
      duration: options?.duration ?? 5000,
      dismissible: true,
      ...finalOptions,
    });
  },

  warning: (message: React.ReactNode, options?: NotifyOptions) => {
    const { title, options: finalOptions } = formatToastPayload("warning", message, options);
    return sonnerToast.warning(title, {
      duration: options?.duration ?? 5000,
      dismissible: true,
      ...finalOptions,
    });
  },

  info: (message: React.ReactNode, options?: NotifyOptions) => {
    const { title, options: finalOptions } = formatToastPayload("info", message, options);
    return sonnerToast.info(title, {
      duration: options?.duration ?? 4500,
      dismissible: true,
      ...finalOptions,
    });
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

    return sonnerToast.promise(guardedPromise, {
      loading: data.loading,
      success: data.success,
      error: data.error,
      description: data.description,
      finally: data.finally,
    });
  },

  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id);
  },
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
};
