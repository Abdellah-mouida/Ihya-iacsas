"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";

export interface NotifyOptions extends ExternalToast {
  /** Optional timeout safety net in ms for async operations (defaults to 15000ms) */
  timeoutMs?: number;
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
 * Provides Islamic geometric styling, glassmorphism, RTL/LTR awareness,
 * and built-in timeout safety nets across all forms.
 */
export const notify = {
  success: (message: React.ReactNode, options?: NotifyOptions) => {
    return sonnerToast.success(message, {
      duration: options?.duration ?? 4500,
      dismissible: true,
      ...options,
    });
  },

  error: (message: React.ReactNode, options?: NotifyOptions) => {
    return sonnerToast.error(message, {
      duration: options?.duration ?? 5000,
      dismissible: true,
      ...options,
    });
  },

  warning: (message: React.ReactNode, options?: NotifyOptions) => {
    return sonnerToast.warning(message, {
      duration: options?.duration ?? 5000,
      dismissible: true,
      ...options,
    });
  },

  info: (message: React.ReactNode, options?: NotifyOptions) => {
    return sonnerToast.info(message, {
      duration: options?.duration ?? 4500,
      dismissible: true,
      ...options,
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

export { sonnerToast as toast };
