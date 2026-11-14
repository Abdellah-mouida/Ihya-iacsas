"use client";

import { useCallback, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ReportStatusFilter = "OPEN" | "RESOLVED" | "DISMISSED" | "ALL";

export interface ModerationReportRow {
  id: string;
  reason: string;
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  reviewedAt: string | null;
  resolutionNote: string | null;
  conversation: {
    id: string;
    type: "PUBLIC" | "DM" | "ROOM";
    name: string | null;
  };
  messageId: string | null;
  messageDeleted: boolean;
  snapshotBody: string | null;
  reporter: {
    id: string;
    name: string | null;
    email: string | null;
  };
  reportedUser: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    chatPublicTimeoutUntil: string | null;
    chatBannedAt: string | null;
    chatBannedReason: string | null;
  } | null;
  reviewedBy: {
    id: string;
    name: string | null;
  } | null;
}

export interface ModerationUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  chatPublicTimeoutUntil: string | null;
  chatBannedAt: string | null;
  chatBannedReason: string | null;
}

export interface ModerationDashboardPayload {
  chatEnabled: boolean;
  counts: { OPEN: number; RESOLVED: number; DISMISSED: number };
  reports: ModerationReportRow[];
  users: ModerationUserRow[];
}

export function AdminModerationView({
  initialData,
  canManageSettings,
}: {
  initialData: ModerationDashboardPayload;
  canManageSettings: boolean;
}) {
  const { t, locale } = useLocale();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [data, setData] = useState<ModerationDashboardPayload>(initialData);
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("OPEN");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));

  const refresh = useCallback(
    async (nextStatus: ReportStatusFilter = statusFilter, nextSearch = searchQuery) => {
      try {
        const params = new URLSearchParams({ status: nextStatus });
        if (nextSearch.trim().length >= 2) {
          params.set("search", nextSearch.trim());
        }
        const res = await fetch(`/api/admin/moderation?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as ModerationDashboardPayload;
        setNowMs(Date.now());
        setData(payload);
      } catch {
        // Keep current view on transient fetch failure
      }
    },
    [searchQuery, statusFilter],
  );

  const handleToggleChat = async () => {
    if (!canManageSettings || busyKey) return;
    const nextEnabled = !data.chatEnabled;
    const ok = await confirm({
      title: t("adminModeration.toggleConfirmTitle"),
      description: nextEnabled
        ? t("adminModeration.toggleConfirmEnableDesc")
        : t("adminModeration.toggleConfirmDisableDesc"),
      variant: nextEnabled ? "default" : "destructive",
    });
    if (!ok) return;

    setBusyKey("toggle-chat");
    try {
      const res = await fetch("/api/admin/moderation/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!res.ok) {
        notify.error(t("adminModeration.actionFailed"));
        return;
      }
      notify.success(t("adminModeration.toggleUpdated"));
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyKey("search");
    try {
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const handleResolveReport = async (
    reportId: string,
    status: "RESOLVED" | "DISMISSED",
  ) => {
    if (busyKey) return;
    setBusyKey(`resolve-${reportId}`);
    try {
      const res = await fetch(`/api/admin/moderation/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        notify.error(t("adminModeration.actionFailed"));
        return;
      }
      notify.success(t("adminModeration.actionDone"));
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeletePublicMessage = async (messageId: string) => {
    if (busyKey) return;
    const ok = await confirm({
      title: t("adminModeration.deletePublicConfirmTitle"),
      description: t("adminModeration.deletePublicConfirmDesc"),
      variant: "destructive",
    });
    if (!ok) return;

    setBusyKey(`delete-${messageId}`);
    try {
      const res = await fetch(`/api/admin/moderation/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Removed by moderator" }),
      });
      if (!res.ok) {
        notify.error(t("adminModeration.actionFailed"));
        return;
      }
      notify.success(t("adminModeration.actionDone"));
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const handleTimeoutUser = async (userId: string, hours: number) => {
    if (busyKey) return;
    setBusyKey(`timeout-${userId}`);
    try {
      const res = await fetch(`/api/admin/moderation/users/${userId}/timeout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours,
          reason: hours > 0 ? `${hours}h public timeout` : "Timeout cleared",
        }),
      });
      if (!res.ok) {
        notify.error(t("adminModeration.actionFailed"));
        return;
      }
      notify.success(t("adminModeration.actionDone"));
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const handleBanUser = async (
    userId: string,
    userName: string | null,
    banned: boolean,
  ) => {
    if (busyKey) return;
    if (banned) {
      const ok = await confirm({
        title: t("adminModeration.banConfirmTitle"),
        description: t("adminModeration.banConfirmDesc").replace(
          "{name}",
          userName || "User",
        ),
        variant: "destructive",
      });
      if (!ok) return;
    }

    setBusyKey(`ban-${userId}`);
    try {
      const res = await fetch(`/api/admin/moderation/users/${userId}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned }),
      });
      if (!res.ok) {
        notify.error(t("adminModeration.actionFailed"));
        return;
      }
      notify.success(t("adminModeration.actionDone"));
      await refresh(statusFilter, searchQuery);
    } finally {
      setBusyKey(null);
    }
  };

  const renderUserStatusBadge = (
    timeoutUntil: string | null,
    bannedAt: string | null,
  ) => {
    if (bannedAt) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
          <Ban className="size-3" />
          {t("adminModeration.bannedStatus")}
        </span>
      );
    }
    if (timeoutUntil && new Date(timeoutUntil).getTime() > nowMs) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-brass/30 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass">
          <Clock className="size-3" />
          {t("adminModeration.timeoutStatus").replace(
            "{time}",
            formatTime(timeoutUntil),
          )}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        {t("adminModeration.activeStatus")}
      </span>
    );
  };

  const totalOpen = data.counts.OPEN;

  return (
    <div className="space-y-6" data-testid="admin-moderation-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <ShieldAlert className="size-5" />
            <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              {t("adminModeration.title")}
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {t("adminModeration.subtitle")}
          </p>
        </div>
      </div>

      {/* Global chatEnabled Switch */}
      <section className="glass rounded-2xl border border-border/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="font-heading text-base font-bold text-foreground">
                {t("adminModeration.chatToggleTitle")}
              </h2>
              <span
                data-testid="admin-chat-enabled-status"
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  data.chatEnabled
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {data.chatEnabled
                  ? t("adminModeration.chatStatusEnabled")
                  : t("adminModeration.chatStatusDisabled")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("adminModeration.chatToggleDesc")}
            </p>
          </div>
          {canManageSettings ? (
            <Button
              type="button"
              data-testid="admin-chat-enabled-toggle"
              variant={data.chatEnabled ? "destructive" : "default"}
              disabled={busyKey === "toggle-chat"}
              onClick={handleToggleChat}
            >
              {data.chatEnabled
                ? t("adminModeration.disableChatBtn")
                : t("adminModeration.enableChatBtn")}
            </Button>
          ) : (
            <span className="text-xs font-medium text-muted-foreground">
              {t("adminModeration.adminOnlyToggle")}
            </span>
          )}
        </div>
      </section>

      {/* Member Lookup */}
      <section className="glass rounded-2xl border border-border/70 p-5 space-y-4">
        <h2 className="font-heading text-base font-bold text-foreground">
          {t("adminModeration.userLookupTitle")}
        </h2>
        <form onSubmit={handleSearchUsers} className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("adminModeration.userLookupPlaceholder")}
              className="ps-9"
              data-testid="admin-moderation-user-search"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busyKey === "search"}>
            {t("adminModeration.searchBtn")}
          </Button>
        </form>

        {searchQuery.trim().length >= 2 ? (
          data.users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("adminModeration.noUsersMatched")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {data.users.map((u) => {
                const isTimedOut = Boolean(
                  u.chatPublicTimeoutUntil &&
                    new Date(u.chatPublicTimeoutUntil).getTime() > nowMs,
                );
                const isBanned = Boolean(u.chatBannedAt);
                return (
                  <div
                    key={u.id}
                    data-testid={`moderation-user-row-${u.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {u.name || u.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                      <div className="mt-1.5">
                        {renderUserStatusBadge(
                          u.chatPublicTimeoutUntil,
                          u.chatBannedAt,
                        )}
                      </div>
                    </div>
                    {u.role !== "ADMIN" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyKey === `timeout-${u.id}`}
                          onClick={() => handleTimeoutUser(u.id, 1)}
                        >
                          {t("adminModeration.timeout1h")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyKey === `timeout-${u.id}`}
                          onClick={() => handleTimeoutUser(u.id, 24)}
                        >
                          {t("adminModeration.timeout24h")}
                        </Button>
                        {isTimedOut ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyKey === `timeout-${u.id}`}
                            onClick={() => handleTimeoutUser(u.id, 0)}
                          >
                            {t("adminModeration.clearTimeout")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant={isBanned ? "outline" : "destructive"}
                          disabled={busyKey === `ban-${u.id}`}
                          onClick={() => handleBanUser(u.id, u.name, !isBanned)}
                        >
                          {isBanned
                            ? t("adminModeration.unbanBtn")
                            : t("adminModeration.banBtn")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </section>

      {/* Reports Queue */}
      <section className="glass rounded-2xl border border-border/70 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-bold text-foreground">
              {t("adminModeration.reportsTitle")}
            </h2>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
              {totalOpen}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {(
              [
                { id: "OPEN", label: `${t("adminModeration.filterOpen")} (${data.counts.OPEN})` },
                { id: "RESOLVED", label: `${t("adminModeration.filterResolved")} (${data.counts.RESOLVED})` },
                { id: "DISMISSED", label: `${t("adminModeration.filterDismissed")} (${data.counts.DISMISSED})` },
                { id: "ALL", label: t("adminModeration.filterAll") },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  void refresh(tab.id, searchQuery);
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                  statusFilter === tab.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3" data-testid="admin-reports-list">
          {data.reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("adminModeration.noReports")}
            </p>
          ) : (
            data.reports.map((report) => {
              const target = report.reportedUser;
              const isBanned = Boolean(target?.chatBannedAt);
              return (
                <article
                  key={report.id}
                  data-testid={`moderation-report-${report.id}`}
                  className="rounded-xl border border-border/70 bg-background/60 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 font-semibold text-foreground">
                          {t("adminModeration.conversationLabel").replace(
                            "{type}",
                            report.conversation.type,
                          )}
                        </span>
                        <span className="rounded-md border border-border px-2 py-0.5 font-semibold text-foreground">
                          {report.status}
                        </span>
                        {report.messageDeleted ? (
                          <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                            {t("adminModeration.messageDeletedBadge")}
                          </span>
                        ) : null}
                        <span>{formatTime(report.createdAt)}</span>
                      </div>
                      <p>
                        {t("adminModeration.reportedBy").replace(
                          "{name}",
                          report.reporter.name || report.reporter.email || "—",
                        )}
                        {" · "}
                        {t("adminModeration.reportedUser").replace(
                          "{name}",
                          target?.name || target?.email || "—",
                        )}
                      </p>
                    </div>
                    {target
                      ? renderUserStatusBadge(
                          target.chatPublicTimeoutUntil,
                          target.chatBannedAt,
                        )
                      : null}
                  </div>

                  <div className="rounded-lg border border-border/60 bg-card/70 p-3 space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {t("adminModeration.snapshotLabel")}
                    </p>
                    <p
                      dir="auto"
                      data-testid={`moderation-snapshot-${report.id}`}
                      className="whitespace-pre-wrap break-words text-sm text-foreground"
                    >
                      {report.snapshotBody ?? t("adminModeration.snapshotUnavailable")}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {t("adminModeration.reasonLabel")}:
                    </span>{" "}
                    {report.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {report.conversation.type === "PUBLIC" &&
                    report.messageId &&
                    !report.messageDeleted ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        data-testid={`moderation-delete-msg-${report.id}`}
                        disabled={Boolean(busyKey)}
                        onClick={() => handleDeletePublicMessage(report.messageId!)}
                      >
                        <Trash2 className="size-3.5" />
                        {t("adminModeration.deletePublicBtn")}
                      </Button>
                    ) : null}

                    {target && target.role !== "ADMIN" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`moderation-timeout-24h-${report.id}`}
                          disabled={Boolean(busyKey)}
                          onClick={() => handleTimeoutUser(target.id, 24)}
                        >
                          <Clock className="size-3.5" />
                          {t("adminModeration.timeout24h")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={isBanned ? "outline" : "destructive"}
                          data-testid={`moderation-ban-${report.id}`}
                          disabled={Boolean(busyKey)}
                          onClick={() =>
                            handleBanUser(target.id, target.name, !isBanned)
                          }
                        >
                          <Ban className="size-3.5" />
                          {isBanned
                            ? t("adminModeration.unbanBtn")
                            : t("adminModeration.banBtn")}
                        </Button>
                      </>
                    ) : null}

                    {report.status === "OPEN" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          data-testid={`moderation-resolve-${report.id}`}
                          disabled={Boolean(busyKey)}
                          onClick={() =>
                            handleResolveReport(report.id, "RESOLVED")
                          }
                        >
                          <CheckCircle2 className="size-3.5" />
                          {t("adminModeration.resolveBtn")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          data-testid={`moderation-dismiss-${report.id}`}
                          disabled={Boolean(busyKey)}
                          onClick={() =>
                            handleResolveReport(report.id, "DISMISSED")
                          }
                        >
                          <XCircle className="size-3.5" />
                          {t("adminModeration.dismissBtn")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      {ConfirmDialogComponent}
    </div>
  );
}
