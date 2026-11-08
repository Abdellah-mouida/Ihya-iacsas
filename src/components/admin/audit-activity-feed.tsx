"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTION_KEYS } from "@/lib/audit-actions";
import { useLocale } from "@/i18n/locale-provider";

export type AuditActivityItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  targetEmail: string | null;
  details: unknown;
  createdAt: Date | string;
  actorName: string | null;
  actorEmail: string | null;
  actor: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
};

type AuditActivityFeedProps = {
  logs: AuditActivityItem[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  action: string;
  onActionChange: (action: string) => void;
  onLoadMore: () => void;
  onRetry: () => void;
  showActionFilter?: boolean;
  showActor?: boolean;
};

function asDetails(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getTarget(log: AuditActivityItem, isAr: boolean, t: (key: string) => string): string {
  const details = asDetails(log.details);
  const previousRole = details.previousRole;
  const nextRole = details.newRole;
  if (typeof previousRole === "string" && typeof nextRole === "string") {
    const roleLabel = (role: string) => {
      const key = {
        ADMIN: "adminUsers.roleAdmin",
        MODERATOR: "adminUsers.roleModerator",
        USER: "adminUsers.roleUser",
      }[role];
      return key ? t(key) : role;
    };
    return `${roleLabel(previousRole)} → ${roleLabel(nextRole)}`;
  }

  for (const key of ["eventTitle", "fullName", "targetName", "name"]) {
    const value = details[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return log.targetName || log.targetEmail || log.actorEmail ||
    (log.targetId ? `${log.targetType} · ${log.targetId}` : isAr ? "تفاصيل الهدف غير متاحة" : "Target details unavailable");
}

function exactDateTime(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA-u-nu-latn" : "en-GB", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "long",
  }).format(new Date(value));
}

function relativeDateTime(value: Date | string, locale: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-MA-u-nu-latn" : "en", {
    numeric: "auto",
  });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(seconds) >= secondsPerUnit) {
      return formatter.format(Math.round(seconds / secondsPerUnit), unit);
    }
  }
  return formatter.format(seconds, "second");
}

function dayKey(value: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dayLabel(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA-u-nu-latn" : "en-GB", {
    timeZone: "Africa/Casablanca",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function AuditActivityFeed({
  logs,
  loading,
  loadingMore,
  error,
  hasMore,
  action,
  onActionChange,
  onLoadMore,
  onRetry,
  showActionFilter = true,
  showActor = false,
}: AuditActivityFeedProps) {
  const { t, locale } = useLocale();
  const isAr = locale === "ar";

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, AuditActivityItem[]>();
    for (const log of logs) {
      const key = dayKey(log.createdAt);
      const group = groups.get(key) ?? [];
      group.push(log);
      groups.set(key, group);
    }
    return [...groups.entries()];
  }, [logs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="audit-activity-feed">
      {showActionFilter && (
        <div className="sticky top-0 z-20 border-b border-border/50 bg-card/95 px-4 py-3 backdrop-blur-xl sm:px-6">
          <label htmlFor="activity-action-filter" className="sr-only">
            {t("adminUsers.activityActionFilter")}
          </label>
          <Select value={action} onValueChange={onActionChange}>
            <SelectTrigger id="activity-action-filter" data-testid="activity-action-filter" className="h-11 w-full sm:max-w-sm">
              <SelectValue placeholder={t("adminUsers.activityActionFilter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("adminUsers.activityAllActions")}</SelectItem>
              {AUDIT_ACTION_KEYS.map((key) => (
                <SelectItem key={key} value={key}>{t(`audit.actions.${key}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite" aria-busy={loading || loadingMore}>
        {loading ? (
          <div className="space-y-3" data-testid="activity-loading-skeleton" aria-label={t("adminUsers.activityLoading")}>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border border-border/50 bg-muted/30" />
            ))}
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("adminUsers.activityError")}</p>
            <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onRetry}>
              {t("adminUsers.activityRetry")}
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground" data-testid="activity-empty-state">
            {t("adminUsers.activityEmpty")}
          </div>
        ) : (
          <div className="space-y-5">
            {groupedLogs.map(([key, dayLogs]) => (
              <section key={key} aria-label={dayLabel(dayLogs[0].createdAt, locale)}>
                <h3 className="sticky top-0 z-10 -mx-1 mb-2 rounded-lg border border-border/50 bg-background/95 px-3 py-2 text-xs font-bold text-foreground shadow-sm backdrop-blur-xl">
                  {dayLabel(dayLogs[0].createdAt, locale)}
                </h3>
                <ol className="space-y-2" aria-label={dayLabel(dayLogs[0].createdAt, locale)}>
                  {dayLogs.map((log) => {
                    const actorName = log.actor?.name || log.actorName || log.actor?.email || log.actorEmail || t("adminUsers.activitySystem");
                    const actionLabel = t(`audit.actions.${log.action}`);
                    return (
                      <li key={log.id} className="rounded-xl border border-border/50 bg-card/75 p-3 shadow-sm backdrop-blur-md sm:p-4" data-testid="activity-row">
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-5 text-foreground">{actionLabel}</p>
                            <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                              <span className="font-medium text-foreground/80">{t("adminUsers.activityTarget")}:</span>{" "}
                              {getTarget(log, isAr, t)}
                            </p>
                            {showActor && (
                              <p className="mt-1 break-words text-xs text-muted-foreground">
                                {actorName}{log.actor?.role ? ` · ${log.actor.role}` : ""}
                                {(log.actorEmail || log.actor?.email) ? ` · ${log.actorEmail || log.actor?.email}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:flex-col sm:items-end sm:gap-0.5">
                            <time dateTime={new Date(log.createdAt).toISOString()} data-testid="activity-exact-time">
                              {exactDateTime(log.createdAt, locale)}
                            </time>
                            <span title={t("adminUsers.activityTimezone")}>{relativeDateTime(log.createdAt, locale)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            {hasMore && (
              <div className="flex justify-center py-2">
                <Button type="button" variant="outline" data-testid="activity-load-more" className="min-h-11 min-w-40 rounded-xl" disabled={loadingMore} onClick={onLoadMore}>
                  {loadingMore ? t("adminUsers.activityLoading") : t("adminUsers.activityLoadMore")}
                  {!loadingMore && <ChevronDown className="ms-2 size-4" aria-hidden="true" />}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
