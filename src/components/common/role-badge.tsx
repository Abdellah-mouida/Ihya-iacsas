"use client";

import { Crown, Shield, ShieldCheck, User } from "lucide-react";
import React from "react";

import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type UserRole = "ADMIN" | "MODERATOR" | "USER";

interface RoleBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  role: UserRole;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RoleBadge({
  role,
  showIcon = true,
  size = "md",
  className,
  ...props
}: RoleBadgeProps) {
  const { t } = useLocale();

  const roleConfig: Record<
    UserRole,
    {
      label: string;
      icon: React.ReactNode;
      className: string;
    }
  > = {
    ADMIN: {
      label: t("adminUsers.roleAdmin"),
      icon: <ShieldCheck className="size-3.5 shrink-0" />,
      className:
        "bg-primary/10 text-primary border-primary/25 shadow-xs font-semibold",
    },
    MODERATOR: {
      label: t("adminUsers.roleModerator"),
      icon: <Shield className="size-3.5 shrink-0" />,
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 shadow-xs font-semibold",
    },
    USER: {
      label: t("adminUsers.roleUser"),
      icon: <User className="size-3.5 shrink-0" />,
      className:
        "bg-muted text-muted-foreground border-border/50 font-medium",
    },
  };

  const current = roleConfig[role] || roleConfig.USER;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  return (
    <span
      data-testid={`role-badge-${role.toLowerCase()}`}
      className={cn(
        "inline-flex items-center rounded-full border transition-colors",
        current.className,
        sizeClasses[size],
        className,
      )}
      data-role={role}
      {...props}
    >
      {showIcon && current.icon}
      <span>{current.label}</span>
    </span>
  );
}
