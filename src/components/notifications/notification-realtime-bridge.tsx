"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale } from "@/i18n/locale-provider";
import {
  getActiveChatConversation,
  onActiveChatConversationChange,
  scheduleDeliveryAck,
} from "@/lib/chat/active-chat";
import { decryptWireMessageToDto } from "@/lib/chat/client-crypto";
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
  const mutedConvIdsRef = useRef<Set<string>>(new Set());
  const chatUnreadRef = useRef(0);
  const notifUnreadRef = useRef(0);
  const pendingChatGroupsRef = useRef<
    Map<string, { count: number; senderName: string; preview: string }>
  >(new Map());

  const syncDocumentTitle = () => {
    if (typeof document === "undefined") return;
    const total = Math.max(0, chatUnreadRef.current) + Math.max(0, notifUnreadRef.current);
    const cleanTitle = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = total > 0 ? `(${total}) ${cleanTitle}` : cleanTitle;
  };

  useEffect(() => {
    pathnameRef.current = pathname;
    tRef.current = t;
    localeRef.current = locale;
    routerRef.current = router;
    const frame = window.requestAnimationFrame(() => {
      syncDocumentTitle();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, t, locale, router]);

  useEffect(() => {
    return onActiveChatConversationChange((convId) => {
      if (convId) {
        pendingChatGroupsRef.current.delete(convId);
      }
    });
  }, []);

  useEffect(() => {
    const onNotifUnread = (event: Event) => {
      const total = (event as CustomEvent<{ total?: number }>).detail?.total;
      if (typeof total === "number") {
        notifUnreadRef.current = Math.max(0, total);
        syncDocumentTitle();
      }
    };
    const onChatUnread = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          publicTotal?: number;
          privateTotal?: number;
          total?: number;
          count?: number;
        }>
      ).detail;
      if (
        typeof detail?.publicTotal === "number" ||
        typeof detail?.privateTotal === "number"
      ) {
        chatUnreadRef.current =
          Math.max(0, detail.publicTotal ?? 0) +
          Math.max(0, detail.privateTotal ?? 0);
        syncDocumentTitle();
      } else if (typeof detail?.total === "number") {
        chatUnreadRef.current = Math.max(0, detail.total);
        syncDocumentTitle();
      } else if (typeof detail?.count === "number") {
        chatUnreadRef.current = Math.max(0, detail.count);
        syncDocumentTitle();
      }
    };
    window.addEventListener("ihyaa_notifications_unread", onNotifUnread);
    window.addEventListener("ihyaa_chat_unread", onChatUnread);
    return () => {
      window.removeEventListener("ihyaa_notifications_unread", onNotifUnread);
      window.removeEventListener("ihyaa_chat_unread", onChatUnread);
    };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      clearStoredSummaryFlags();
      chatUnreadRef.current = 0;
      notifUnreadRef.current = 0;
      mutedConvIdsRef.current = new Set();
      pendingChatGroupsRef.current.clear();
      syncDocumentTitle();
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

    const fetchChatUnread = async () => {
      try {
        const res = await fetch("/api/chat/unread", { cache: "no-store" });
        if (!res.ok || disposed) return;
        const data = (await res.json()) as {
          publicUnread?: number;
          privateUnread?: number;
          mutedConversationIds?: string[];
        };
        if (Array.isArray(data.mutedConversationIds)) {
          mutedConvIdsRef.current = new Set(data.mutedConversationIds);
        }
        const publicTotal = Math.max(0, data.publicUnread ?? 0);
        const privateTotal = Math.max(0, data.privateUnread ?? 0);
        chatUnreadRef.current = publicTotal + privateTotal;
        syncDocumentTitle();
      } catch {
        // Silent network fallback
      }
    };

    const handleRealtimeChatMessage = async (event: {
      type: "message.created";
      conversationId: string;
      messageId: string;
      senderId: string;
      createdAt: string;
      conversationType?: string;
      conversationTitle?: string | null;
      wire?: import("@/lib/chat/realtime/types").WireEncryptedMessagePayload;
    }) => {
      if (event.senderId === userId) return;

      if (event.conversationType !== "PUBLIC") {
        scheduleDeliveryAck(event.conversationId, event.createdAt);
      }

      const inChatRoute =
        pathnameRef.current.startsWith("/chat") ||
        pathnameRef.current.startsWith("/messages");
      const viewingSameConv =
        inChatRoute &&
        getActiveChatConversation() === event.conversationId &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        document.hasFocus();

      if (viewingSameConv) {
        pendingChatGroupsRef.current.delete(event.conversationId);
        return;
      }

      if (!inChatRoute) {
        chatUnreadRef.current += 1;
        syncDocumentTitle();
        window.dispatchEvent(new CustomEvent("ihyaa_chat_unread"));
      }

      if (mutedConvIdsRef.current.has(event.conversationId)) {
        return;
      }

      let senderName =
        event.wire?.sender?.name ||
        event.conversationTitle ||
        tRef.current("chatInvite.unknownInviter");
      let preview = "";

      if (event.wire) {
        const decrypted = await decryptWireMessageToDto(event.wire);
        if (decrypted) {
          senderName = decrypted.sender?.name || senderName;
          preview = decrypted.body?.trim() || "";
        }
      }

      if (disposed) return;

      const prevGroup = pendingChatGroupsRef.current.get(event.conversationId);
      const nextCount = (prevGroup?.count ?? 0) + 1;
      pendingChatGroupsRef.current.set(event.conversationId, {
        count: nextCount,
        senderName,
        preview: preview || prevGroup?.preview || "",
      });

      const titleText =
        nextCount === 1
          ? tRef.current("chat.groupedNewMessageSingle", { name: senderName })
          : tRef.current("chat.groupedNewMessages", {
              count: nextCount,
              name: senderName,
            });

      const targetHref =
        event.conversationType === "PUBLIC"
          ? "/chat"
          : `/chat?conversation=${encodeURIComponent(event.conversationId)}`;

      notify.info(titleText, {
        id: `chat-msg-${event.conversationId}`,
        description: preview || undefined,
        duration: 6000,
        action: {
          label: tRef.current("notifications.viewAction"),
          onClick: () => {
            pendingChatGroupsRef.current.delete(event.conversationId);
            routerRef.current.push(targetHref);
          },
        },
      });
    };

    const boot = () => {
      void fetchSummary(true);
      void fetchChatUnread();
      import("@/lib/chat/realtime/client")
        .then(({ getChatRealtimeClient }) => {
          if (disposed) return;
          const client = getChatRealtimeClient();
          release = client.acquire();
          client.connectNow();
          unsubscribeReconnect = client.onReconnect(() => {
            void fetchSummary(false);
            void fetchChatUnread();
          });
          unsubscribeEvents = client.onEvent((event) => {
            if (event.type === "notification.created") {
              void handleRealtimeNotification(event.notificationId);
              return;
            }
            if (event.type === "notifications.changed") {
              if (typeof event.unreadCount === "number") {
                dispatchNotificationUnreadTotal(event.unreadCount);
              } else {
                void fetchSummary(false);
              }
              window.dispatchEvent(
                new CustomEvent("ihyaa_notifications_changed", {
                  detail: event,
                }),
              );
              return;
            }
            if (event.type === "unread.sync") {
              void fetchChatUnread();
              return;
            }
            if (event.type === "message.created") {
              void handleRealtimeChatMessage(event);
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
