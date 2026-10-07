"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useLocale } from "@/i18n/locale-provider";

function useSafeLocale(): { dir: "rtl" | "ltr"; locale: "ar" | "en" } {
  try {
    const ctx = useLocale();
    return { dir: ctx.dir, locale: ctx.locale };
  } catch {
    return { dir: "rtl", locale: "ar" };
  }
}

/**
 * Islamic Geometric Rub el Hizb (8-pointed star) Success Icon
 */
function IslamicSuccessIcon() {
  return (
    <div
      data-testid="toast-icon-success"
      className="relative flex items-center justify-center size-6 shrink-0 text-emerald-600 dark:text-emerald-400 select-none"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        {/* Base rotated square 1 */}
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="1.5"
        />
        {/* Interlacing square 2 (rotated 45deg) creating 8-pointed geometric star */}
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          transform="rotate(45 12 12)"
          className="stroke-brass"
          strokeWidth="1.5"
          strokeOpacity="0.85"
        />
        {/* Checkmark */}
        <path
          d="M8.75 12.25L10.75 14.25L15.25 9.75"
          className="stroke-emerald-600 dark:stroke-emerald-400"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 -z-10 rounded-full bg-emerald-500/15 blur-sm" />
    </div>
  );
}

/**
 * Islamic Geometric Rub el Hizb (8-pointed star) Error Icon
 */
function IslamicErrorIcon() {
  return (
    <div
      data-testid="toast-icon-error"
      className="relative flex items-center justify-center size-6 shrink-0 text-rose-600 dark:text-rose-400 select-none"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          className="stroke-rose-600 dark:stroke-rose-400"
          strokeWidth="1.5"
        />
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          transform="rotate(45 12 12)"
          className="stroke-rose-500/70 dark:stroke-rose-400/70"
          strokeWidth="1.5"
        />
        <path
          d="M9.5 9.5L14.5 14.5M14.5 9.5L9.5 14.5"
          className="stroke-rose-600 dark:stroke-rose-400"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 -z-10 rounded-full bg-rose-500/15 blur-sm" />
    </div>
  );
}

/**
 * Islamic Geometric Rub el Hizb (8-pointed star) Warning Icon
 */
function IslamicWarningIcon() {
  return (
    <div
      data-testid="toast-icon-warning"
      className="relative flex items-center justify-center size-6 shrink-0 text-amber-600 dark:text-amber-400 select-none"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          className="stroke-amber-600 dark:stroke-amber-400"
          strokeWidth="1.5"
        />
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          transform="rotate(45 12 12)"
          className="stroke-gold"
          strokeWidth="1.5"
        />
        <path
          d="M12 8.5V13M12 15.5V15.75"
          className="stroke-amber-600 dark:stroke-amber-400"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 -z-10 rounded-full bg-amber-500/15 blur-sm" />
    </div>
  );
}

/**
 * Islamic Geometric Rub el Hizb (8-pointed star) Info Icon
 */
function IslamicInfoIcon() {
  return (
    <div
      data-testid="toast-icon-info"
      className="relative flex items-center justify-center size-6 shrink-0 text-brass select-none"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none">
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          className="stroke-brass"
          strokeWidth="1.5"
        />
        <rect
          x="4.75"
          y="4.75"
          width="14.5"
          height="14.5"
          rx="1.75"
          transform="rotate(45 12 12)"
          className="stroke-gold"
          strokeWidth="1.5"
        />
        <path
          d="M12 8.25V8.5M12 11V15.75"
          className="stroke-brass"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-0 -z-10 rounded-full bg-brass/15 blur-sm" />
    </div>
  );
}

/**
 * Islamic Geometric Rotating Medallion Loader
 */
function IslamicLoadingIcon() {
  return (
    <div
      data-testid="toast-icon-loading"
      className="relative flex items-center justify-center size-6 shrink-0 text-brass select-none"
      aria-hidden
    >
      <svg viewBox="0 0 50 50" className="size-6 animate-spin" fill="none">
        <rect
          x="13"
          y="13"
          width="24"
          height="24"
          transform="rotate(45 25 25)"
          strokeWidth="2.5"
          className="stroke-brass"
        />
        <circle
          cx="25"
          cy="25"
          r="4"
          fill="currentColor"
          className="text-emerald-600 dark:text-emerald-400"
        />
      </svg>
    </div>
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const { dir, locale } = useSafeLocale();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={dir}
      duration={4500}
      closeButton
      className="toaster group"
      icons={{
        success: <IslamicSuccessIcon />,
        info: <IslamicInfoIcon />,
        warning: <IslamicWarningIcon />,
        error: <IslamicErrorIcon />,
        loading: <IslamicLoadingIcon />,
      }}
      toastOptions={{
        closeButtonAriaLabel: locale === "ar" ? "إغلاق الإشعار" : "Close notification",
        classNames: {
          toast: "cn-toast",
          title: "cn-toast-title",
          description: "cn-toast-description",
          actionButton: "cn-toast-action",
          cancelButton: "cn-toast-cancel",
          closeButton: "cn-toast-close",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
