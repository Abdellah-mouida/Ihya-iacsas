"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CalendarX,
  Check,
  CheckCheck,
  DoorOpen,
  MailOpen,
  Shield,
  Sparkles,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import {
  resolveNotificationDisplay,
  type NotificationIconName,
  type NotificationItemDTO,
} from "@/lib/notifications-shared";
import { dispatchNotificationUnreadTotal } from "@/components/notifications/notification-realtime-bridge";
import { cn } from "@/lib/utils";

interface NotificationsInboxProps {
  initialItems: NotificationItemDTO[];
  initialNextCursor: string | null;
  initialUnreadCount: number;
}

function NotificationTypeIcon({ icon }: { icon: NotificationIconName }) {
  const props = { className: "size-5 shrink-0", "aria-hidden": true as const };
  switch (icon) {
    case "calendar-check":
      return <CalendarCheck {...props} />;
    case "calendar-x":
      return <CalendarX {...props} />;
    case "user-plus":
      return <UserPlus {...props} />;
    case "user-check":
      return <UserCheck {...props} />;
    case "door-open":
      return <DoorOpen {...props} />;
    case "shield":
      return <Shield {...props} />;
    case "alert-triangle":
      return <AlertTriangle {...props} />;
    case "sparkles":
    default:
      return <Sparkles {...props} />;
  }
}

export function NotificationsInbox({
  initialItems,
  initialNextCursor,
  initialUnreadCount,
}: NotificationsInboxProps) {
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItemDTO[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    dispatchNotificationUnreadTotal(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    const onLiveNotification = (event: Event) => {
      const detail = (
        event as CustomEvent<{ notification?: NotificationItemDTO }>
      ).detail;
      const liveItem = detail?.notification;
      if (!liveItem) return;

      setItems((prev) => {
        if (prev.some((existing) => existing.id === liveItem.id)) return prev;
        return [liveItem, ...prev];
      });
      if (!liveItem.readAt) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    window.addEventListener("ihyaa_notification_received", onLiveNotification);
    return () => {
      window.removeEventListener(
        "ihyaa_notification_received",
        onLiveNotification,
      );
    };
  }, []);

  const formatTimestamp = useCallback(
    (iso: string) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return "";
      const diffMs = Date.now() - date.getTime();
      if (diffMs < 60_000) return t("notifications.justNow");
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    },
    [locale, t],
  );

  const handleFilterChange = async (nextFilter: "all" | "unread") => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    setLoadingFilter(true);
    try {
      const res = await fetch(
        `/api/notifications?filter=${nextFilter}&limit=20`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        items: NotificationItemDTO[];
        nextCursor: string | null;
        unreadCount: number;
      };
      setItems(data.items);
      setNextCursor(data.nextCursor);
      setUnreadCount(data.unreadCount);
    } catch {
      notify.error(t("notifications.updateError"));
    } finally {
      setLoadingFilter(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/notifications?filter=${filter}&limit=20&cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as {
        items: NotificationItemDTO[];
        nextCursor: string | null;
        unreadCount: number;
      };
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const extra = data.items.filter((i) => !seen.has(i.id));
        return [...prev, ...extra];
      });
      setNextCursor(data.nextCursor);
      setUnreadCount(data.unreadCount);
    } catch {
      notify.error(t("notifications.updateError"));
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleReadState = async (item: NotificationItemDTO, nextRead: boolean) => {
    if (pendingIds[item.id]) return;
    setPendingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch(
        `/api/notifications/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: nextRead }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        notification: NotificationItemDTO;
        unreadCount: number;
      };
      setItems((prev) => {
        if (filter === "unread" && nextRead) {
          return prev.filter((row) => row.id !== item.id);
        }
        return prev.map((row) =>
          row.id === item.id ? data.notification : row,
        );
      });
      setUnreadCount(data.unreadCount);
    } catch {
      notify.error(t("notifications.updateError"));
    } finally {
      setPendingIds((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  const handleOpenNotification = async (
    item: NotificationItemDTO,
    targetUrl: string,
  ) => {
    if (!item.readAt) {
      await toggleReadState(item, true);
    }
    router.push(targetUrl);
  };

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error("Failed");
      const nowIso = new Date().toISOString();
      setItems((prev) =>
        filter === "unread"
          ? []
          : prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso })),
      );
      setUnreadCount(0);
      notify.success(t("notifications.markAllSuccess"));
    } catch {
      notify.error(t("notifications.updateError"));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <section
      dir={dir}
      data-testid="notifications-inbox"
      className="relative isolate mx-auto w-full max-w-3xl overflow-hidden px-3 pb-10 pt-24 sm:px-6 sm:pt-28"
    >
      <div className="relative z-10 rounded-3xl border border-border/70 bg-card/80 shadow-xl backdrop-blur-md">
        <div className="flex flex-col gap-4 border-b border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Bell className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">
                  {t("notifications.pageTitle")}
                </h1>
                {unreadCount > 0 && (
                  <span
                    data-testid="notifications-inbox-unread-count"
                    className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("notifications.pageSubtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
            data-testid="notifications-mark-all-btn"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            <span>{t("notifications.markAllRead")}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => void handleFilterChange("all")}
            data-testid="notifications-filter-all"
            className={cn(
              "min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              filter === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t("notifications.filterAll")}
          </button>
          <button
            type="button"
            onClick={() => void handleFilterChange("unread")}
            data-testid="notifications-filter-unread"
            className={cn(
              "min-h-11 rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
              filter === "unread"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t("notifications.filterUnread")}
          </button>
        </div>

        {loadingFilter ? (
          <div className="space-y-3 p-4 sm:p-6">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="h-20 animate-pulse rounded-2xl bg-muted/40"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div
            data-testid="notifications-empty-state"
            className="flex flex-col items-center justify-center px-6 py-14 text-center"
          >
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bell className="size-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">
              {filter === "unread"
                ? t("notifications.emptyUnreadTitle")
                : t("notifications.emptyTitle")}
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {filter === "unread"
                ? t("notifications.emptyUnreadDesc")
                : t("notifications.emptyDesc")}
            </p>
          </div>
        ) : (
          <ul
            data-testid="notifications-list"
            className="divide-y divide-border/50"
          >
            {items.map((item) => {
              const display = resolveNotificationDisplay(item, t, locale);
              const isUnread = !item.readAt;
              return (
                <li
                  key={item.id}
                  data-testid={`notification-item-${item.id}`}
                  data-unread={isUnread ? "true" : "false"}
                  className={cn(
                    "flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-6",
                    isUnread
                      ? "bg-primary/[0.08]"
                      : "bg-transparent hover:bg-muted/30",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      void handleOpenNotification(item, display.targetUrl)
                    }
                    data-testid={`notification-open-${item.id}`}
                    className="flex min-h-11 min-w-0 flex-1 items-start gap-3 text-start"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                        isUnread
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <NotificationTypeIcon icon={display.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {display.title}
                        </span>
                        {isUnread && (
                          <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {t("notifications.unreadBadge")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-foreground/85 [overflow-wrap:anywhere]">
                        {display.body}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatTimestamp(item.createdAt)}
                      </span>
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={Boolean(pendingIds[item.id])}
                      onClick={() => void toggleReadState(item, isUnread)}
                      data-testid={`notification-toggle-read-${item.id}`}
                      aria-label={
                        isUnread
                          ? t("notifications.markRead")
                          : t("notifications.markUnread")
                      }
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
                    >
                      {isUnread ? (
                        <>
                          <Check className="size-4" aria-hidden="true" />
                          <span>{t("notifications.markRead")}</span>
                        </>
                      ) : (
                        <>
                          <MailOpen className="size-4" aria-hidden="true" />
                          <span>{t("notifications.markUnread")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {nextCursor && (
          <div className="border-t border-border/50 p-4 text-center">
            <button
              type="button"
              onClick={() => void handleLoadMore()}
              disabled={loadingMore}
              data-testid="notifications-load-more"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border/70 bg-background/70 px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              {loadingMore
                ? t("notifications.loadingMore")
                : t("notifications.loadMore")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
