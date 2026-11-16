"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import {
  formatOfflineSummaryMessage,
  resolveNotificationDisplay,
  type NotificationItemDTO,
} from "@/lib/notifications-shared";

const SUMMARY_SHOWN_PREFIX = "ihyaa_notif_summary_shown:";

export function formatNotificationSummary(
  count: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: "ar" | "en" = "ar",
): string {
  return formatOfflineSummaryMessage(count, t, locale);
}

function clearStoredSummaryFlags() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SUMMARY_SHOWN_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      sessionStorage.removeItem(k);
    }
  } catch {
    // Ignore storage unavailability
  }
}

function markSummaryShown(userId: string) {
  try {
    sessionStorage.setItem(`${SUMMARY_SHOWN_PREFIX}${userId}`, "1");
  } catch {
    // Ignore storage unavailability
  }
}

function wasSummaryShown(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${SUMMARY_SHOWN_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

export function dispatchNotificationUnreadTotal(total: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("ihyaa_notifications_unread", {
      detail: { total: Math.max(0, total) },
    }),
  );
}

export function NotificationRealtimeBridge() {
  const { data: session, status } = useSession();
  const { t, locale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const tRef = useRef(t);
  const localeRef = useRef(locale);
  const routerRef = useRef(router);

  useEffect(() => {
    pathnameRef.current = pathname;
    tRef.current = t;
    localeRef.current = locale;
    routerRef.current = router;
  }, [pathname, t, locale, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      clearStoredSummaryFlags();
      dispatchNotificationUnreadTotal(0);
    }
  }, [status]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (status !== "authenticated" || !userId) {
      return;
    }

    let disposed = false;
    let release: (() => void) | undefined;
    let unsubscribeEvents: (() => void) | undefined;
    let unsubscribeReconnect: (() => void) | undefined;
    let idleHandle: number | null = null;
    let timerHandle: number | null = null;

    const fetchSummary = async (showOfflineSummary: boolean) => {
      try {
        const res = await fetch("/api/notifications/summary", {
          cache: "no-store",
        });
        if (!res.ok || disposed) return;
        const data = (await res.json()) as { unreadCount?: number };
        const unreadCount = Math.max(0, data.unreadCount ?? 0);
        dispatchNotificationUnreadTotal(unreadCount);

        if (
          showOfflineSummary &&
          unreadCount > 0 &&
          !wasSummaryShown(userId)
        ) {
          markSummaryShown(userId);
          if (pathnameRef.current !== "/notifications") {
            const msg = formatNotificationSummary(
              unreadCount,
              tRef.current,
              localeRef.current,
            );
            notify.info(msg, {
              id: `notif-summary-${userId}`,
              duration: 7000,
              action: {
                label: tRef.current("notifications.viewAction"),
                onClick: () => {
                  routerRef.current.push("/notifications");
                },
              },
            });
          }
        }
      } catch {
        // Silent network fallback
      }
    };

    const handleRealtimeNotification = async (notificationId: string) => {
      try {
        const [itemRes] = await Promise.all([
          fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
            cache: "no-store",
          }),
          fetchSummary(false),
        ]);
        if (!itemRes.ok || disposed) return;
        const payload = (await itemRes.json()) as {
          notification?: NotificationItemDTO;
        };
        const item = payload.notification;
        if (!item) return;

        markSummaryShown(userId);
        window.dispatchEvent(
          new CustomEvent("ihyaa_notification_received", {
            detail: { notification: item },
          }),
        );

        const display = resolveNotificationDisplay(
          item,
          tRef.current,
          localeRef.current,
        );

        notify.info(display.body, {
          id: `notif-${item.id}`,
          description: display.title,
          duration: 6500,
          action: {
            label: tRef.current("notifications.viewAction"),
            onClick: () => {
              void fetch(`/api/notifications/${encodeURIComponent(item.id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ read: true }),
              })
                .then((res) => (res.ok ? res.json() : null))
                .then((updated: { unreadCount?: number } | null) => {
                  if (typeof updated?.unreadCount === "number") {
                    dispatchNotificationUnreadTotal(updated.unreadCount);
                  }
                })
                .catch(() => {});
              routerRef.current.push(display.targetUrl);
            },
          },
        });
      } catch {
        // Silent network fallback
      }
    };

    const boot = () => {
      void fetchSummary(true);
      import("@/lib/chat/realtime/client")
        .then(({ getChatRealtimeClient }) => {
          if (disposed) return;
          const client = getChatRealtimeClient();
          release = client.acquire();
          client.connectNow();
          unsubscribeReconnect = client.onReconnect(() => {
            void fetchSummary(false);
          });
          unsubscribeEvents = client.onEvent((event) => {
            if (event.type === "notification.created") {
              void handleRealtimeNotification(event.notificationId);
            }
          });
        })
        .catch(() => {});
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(boot, { timeout: 1200 });
    } else {
      timerHandle = window.setTimeout(boot, 350);
    }

    return () => {
      disposed = true;
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timerHandle !== null) {
        window.clearTimeout(timerHandle);
      }
      unsubscribeEvents?.();
      unsubscribeReconnect?.();
      release?.();
    };
  }, [session?.user?.id, status]);

  return null;
}
