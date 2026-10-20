"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, XCircle } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

export type StatusNoticeVariant =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "pending"
  | "neutral";

interface StatusNoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusNoticeVariant;
  size?: "sm" | "md" | "lg";
  title?: string;
  description?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
}

const variantStyles: Record<
  StatusNoticeVariant,
  {
    container: string;
    iconColor: string;
    titleColor: string;
    defaultIcon: React.ReactNode;
  }
> = {
  info: {
    container:
      "bg-primary/10 border-primary/20 text-foreground dark:bg-primary/15 dark:border-primary/30",
    iconColor: "text-primary",
    titleColor: "text-foreground font-semibold",
    defaultIcon: <Info className="size-5 shrink-0" />,
  },
  success: {
    container:
      "bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-500/30 dark:text-emerald-100",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    titleColor: "text-emerald-900 dark:text-emerald-200 font-semibold",
    defaultIcon: <CheckCircle2 className="size-5 shrink-0" />,
  },
  warning: {
    container:
      "bg-amber-500/10 border-amber-500/25 text-amber-950 dark:bg-amber-950/20 dark:border-amber-500/30 dark:text-amber-100",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-900 dark:text-amber-200 font-semibold",
    defaultIcon: <AlertTriangle className="size-5 shrink-0" />,
  },
  error: {
    container:
      "bg-destructive/10 border-destructive/25 text-destructive dark:bg-destructive/15 dark:border-destructive/30 dark:text-red-200",
    iconColor: "text-destructive",
    titleColor: "text-destructive font-semibold",
    defaultIcon: <XCircle className="size-5 shrink-0" />,
  },
  pending: {
    container:
      "bg-amber-500/10 border-amber-500/25 text-amber-950 dark:bg-amber-950/20 dark:border-amber-500/30 dark:text-amber-100",
    iconColor: "text-amber-600 dark:text-amber-400",
    titleColor: "text-amber-900 dark:text-amber-200 font-semibold",
    defaultIcon: <Clock className="size-5 shrink-0" />,
  },
  neutral: {
    container:
      "bg-muted/40 border-border/70 text-foreground dark:bg-muted/20 dark:border-border/50",
    iconColor: "text-muted-foreground",
    titleColor: "text-foreground font-semibold",
    defaultIcon: <Info className="size-5 shrink-0" />,
  },
};

export function StatusNotice({
  variant = "info",
  size = "md",
  title,
  description,
  message,
  icon,
  action,
  children,
  className,
  testId,
  ...props
}: StatusNoticeProps) {
  const config = variantStyles[variant];
  const textContent = message || description;

  if (size === "sm") {
    return (
      <span
        role="status"
        data-testid={testId}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm",
          config.container,
          className,
        )}
        {...props}
      >
        <span className={cn("shrink-0", config.iconColor)}>
          {icon ?? config.defaultIcon}
        </span>
        {title && <span className={config.titleColor}>{title}</span>}
        {textContent && <span>{textContent}</span>}
        {children}
      </span>
    );
  }

  return (
    <div
      role="status"
      data-testid={testId}
      className={cn(
        "relative flex w-full gap-3.5 rounded-2xl border p-4 backdrop-blur-sm transition-all duration-200",
        config.container,
        className,
      )}
      {...props}
    >
      <div className={cn("mt-0.5", config.iconColor)}>
        {icon ?? config.defaultIcon}
      </div>
      <div className="flex-1 space-y-1">
        {title && <h4 className={config.titleColor}>{title}</h4>}
        {textContent && (
          <p className="text-sm leading-relaxed opacity-90">{textContent}</p>
        )}
        {children}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
