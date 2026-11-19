"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";
import {
  scheduleDeliveryAck,
  setActiveChatConversation,
} from "@/lib/chat/active-chat";
import {
  clearClientConversationKeys,
  decryptWireMessageToDto,
  storeConversationKeyBundle,
} from "@/lib/chat/client-crypto";
import type { WireEncryptedMessagePayload } from "@/lib/chat/realtime/types";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ChatConversationPane } from "./chat-conversation-pane";
import { ChatSidebar } from "./chat-sidebar";
import { ChatTermsGate } from "./chat-terms-gate";
import {
  type ChatActorInfo,
  type ChatConversationSummary,
  type ChatMessageItem,
  type ChatTab,
  type FriendsDashboardState,
} from "./chat-types";
import styles from "./chat-workspace.module.css";
import { CreateRoomDialog } from "./create-room-dialog";
import { ReportMessageDialog } from "./report-message-dialog";
import { RoomMembersSheet } from "./room-members-sheet";

const EMPTY_FRIENDS: FriendsDashboardState = {
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  blockedUsers: [],
};

function makeClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatWorkspace({
  actor,
  scope = "public",
  initialTab = "friends",
  initialDmPeerId = null,
  initialTermsAccepted,
  initialConversationId,
  initialConversations,
  initialFriends,
  bannedReason,
}: {
  actor: ChatActorInfo;
  scope?: "public" | "private";
  initialTab?: ChatTab;
  initialDmPeerId?: string | null;
  initialTermsAccepted: boolean;
  initialConversationId: string | null;
  initialConversations?: ChatConversationSummary[];
  initialFriends?: FriendsDashboardState;
  bannedReason?: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const isPublicOnly = scope === "public";
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted);
  const [activeTab, setActiveTab] = useState<ChatTab>(initialTab);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    initialConversations ?? [],
  );
  const [friendsData, setFriendsData] = useState<FriendsDashboardState>(
    initialFriends ?? EMPTY_FRIENDS,
  );
  const isBanned = bannedReason !== undefined && bannedReason !== null;
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (isPublicOnly) {
      return initialConversations?.find((c) => c.type === "PUBLIC")?.id ?? null;
    }
    if (
      initialConversationId &&
      initialConversations?.some(
        (c) => c.id === initialConversationId && c.type !== "PUBLIC",
      )
    ) {
      return initialConversationId;
    }
    return null;
  });
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(
    isPublicOnly || initialConversationId || initialDmPeerId ? "thread" : "list",
  );
  const [messagesByConv, setMessagesByConv] = useState<
    Record<string, ChatMessageItem[]>
  >({});
  const [cursorByConv, setCursorByConv] = useState<Record<string, string | null>>({});
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingByConv, setTypingByConv] = useState<
    Record<string, Record<string, { name: string; until: number }>>
  >({});
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [roomPanelOpen, setRoomPanelOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessageItem | null>(null);
  const [vvHeight, setVvHeight] = useState<number | null>(null);

  const selectedIdRef = useRef<string | null>(selectedId);
  const messagesByConvRef = useRef(messagesByConv);
  const conversationsRef = useRef(conversations);
  const friendsRef = useRef(friendsData);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (termsAccepted && !isBanned) {
      setActiveChatConversation(selectedId);
    } else {
      setActiveChatConversation(null);
    }
  }, [selectedId, termsAccepted, isBanned]);

  useEffect(() => {
    return () => {
      setActiveChatConversation(null);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prefixMatch = document.title.match(/^(\(\d+\)\s*)/);
    const prefix = prefixMatch ? prefixMatch[1] : "";
    const pageName = isPublicOnly ? t("chat.pageTitle") : t("chat.messagesPageTitle");
    document.title = `${prefix}${pageName} — ${t("nav.brand")}`;
  }, [isPublicOnly, t]);

  useEffect(() => {
    messagesByConvRef.current = messagesByConv;
  }, [messagesByConv]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    friendsRef.current = friendsData;
  }, [friendsData]);

  const clientRef = useRef<Awaited<
    ReturnType<(typeof import("@/lib/chat/realtime/client"))["getChatRealtimeClient"]>
  > | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      setVvHeight(Math.round(vv.height));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const broadcastUnreadTotal = useCallback(
    (convs: ChatConversationSummary[], incomingCount?: number) => {
      const publicTotal = convs.reduce(
        (sum, c) => sum + (c.type === "PUBLIC" && !c.muted ? c.unreadCount : 0),
        0,
      );
      if (isPublicOnly) {
        window.dispatchEvent(
          new CustomEvent("ihyaa_chat_unread", {
            detail: { publicTotal },
          }),
        );
        return;
      }
      const pendingReqs =
        incomingCount ?? friendsRef.current.incomingRequests.length;
      const privateTotal =
        convs.reduce(
          (sum, c) => sum + (c.type !== "PUBLIC" && !c.muted ? c.unreadCount : 0),
          0,
        ) + pendingReqs;
      window.dispatchEvent(
        new CustomEvent("ihyaa_chat_unread", {
          detail: { publicTotal, privateTotal },
        }),
      );
    },
    [isPublicOnly],
  );

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      if (!res.ok) return [] as ChatConversationSummary[];
      const data = (await res.json()) as { conversations?: ChatConversationSummary[] };
      const list = data.conversations ?? [];
      setConversations(list);
      broadcastUnreadTotal(list);
      setSelectedId((prev) => {
        if (isPublicOnly) {
          return list.find((c) => c.type === "PUBLIC")?.id ?? null;
        }
        if (prev && list.some((c) => c.id === prev && c.type !== "PUBLIC")) return prev;
        return null;
      });
      return list;
    } catch {
      return [] as ChatConversationSummary[];
    }
  }, [broadcastUnreadTotal, isPublicOnly]);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/friends", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as FriendsDashboardState;
      setFriendsData(data);
      broadcastUnreadTotal(conversationsRef.current, data.incomingRequests.length);
    } catch {}
  }, [broadcastUnreadTotal]);

  const markRead = useCallback(
    async (conversationId: string, lastReadAt?: string) => {
      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastReadAt ? { lastReadAt } : {}),
      }).catch(() => {});
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId
            ? { ...c, unreadCount: 0, lastReadAt: lastReadAt || new Date().toISOString() }
            : c,
        );
        broadcastUnreadTotal(next);
        return next;
      });
    },
    [broadcastUnreadTotal],
  );

  const loadMessages = useCallback(
    async (conversationId: string, before?: string | null) => {
      if (!before) setLoadingConvId(conversationId);
      try {
        const params = new URLSearchParams({
          conversationId,
          limit: "30",
          wire: "1",
        });
        if (before) params.set("cursor", before);
        const res = await fetch(`/api/chat/messages?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: ChatMessageItem[];
          wireMessages?: WireEncryptedMessagePayload[];
          keyBundle?: Parameters<typeof storeConversationKeyBundle>[0];
          nextCursor?: string | null;
          peerLastReadAt?: string | null;
          peerLastDeliveredAt?: string | null;
          memberStates?: ChatConversationSummary["memberStates"];
        };

        if (data.keyBundle) {
          storeConversationKeyBundle(data.keyBundle);
        }

        let resolved: ChatMessageItem[] = [];
        if (Array.isArray(data.wireMessages) && data.wireMessages.length > 0) {
          const decrypted = await Promise.all(
            data.wireMessages.map((wire) => decryptWireMessageToDto(wire)),
          );
          const needsFallback = decrypted.some((item) => item === null);
          if (!needsFallback) {
            resolved = decrypted as ChatMessageItem[];
          } else {
            const fallbackRes = await fetch(
              `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}&limit=30${before ? `&cursor=${encodeURIComponent(before)}` : ""}`,
              { cache: "no-store" },
            );
            if (fallbackRes.ok) {
              const fbData = (await fallbackRes.json()) as {
                messages?: ChatMessageItem[];
              };
              resolved = fbData.messages ?? [];
            }
          }
        } else {
          resolved = data.messages ?? [];
        }

        const fetched = resolved.slice().reverse();
        setCursorByConv((prev) => ({
          ...prev,
          [conversationId]: data.nextCursor ?? null,
        }));
        setMessagesByConv((prev) => {
          const existing = prev[conversationId] ?? [];
          if (before) {
            const seenIds = new Set(existing.map((m) => m.id));
            const merged = [
              ...fetched.filter((m) => !seenIds.has(m.id)),
              ...existing,
            ];
            return { ...prev, [conversationId]: merged };
          }
          const pending = existing.filter((m) => m.optimisticState);
          return { ...prev, [conversationId]: [...fetched, ...pending] };
        });

        if (data.memberStates || data.peerLastReadAt || data.peerLastDeliveredAt) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== conversationId) return c;
              return {
                ...c,
                memberStates: data.memberStates ?? c.memberStates,
                peer: c.peer
                  ? {
                      ...c.peer,
                      lastReadAt: data.peerLastReadAt ?? c.peer.lastReadAt,
                      lastDeliveredAt:
                        data.peerLastDeliveredAt ?? c.peer.lastDeliveredAt,
                    }
                  : c.peer,
              };
            }),
          );
        }

        if (!before && fetched.length > 0 && selectedIdRef.current === conversationId) {
          const lastMsg = fetched[fetched.length - 1];
          void markRead(conversationId, lastMsg.createdAt);
        }
      } catch {
      } finally {
        if (!before) setLoadingConvId((cur) => (cur === conversationId ? null : cur));
      }
    },
    [markRead],
  );

  const seededFromServerRef = useRef(
    Boolean(initialConversations && (isPublicOnly || initialFriends)),
  );

  useEffect(() => {
    if (!termsAccepted || isBanned) return;
    if (seededFromServerRef.current) {
      seededFromServerRef.current = false;
      broadcastUnreadTotal(conversationsRef.current);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      if (isPublicOnly) {
        void fetchConversations();
      } else {
        void Promise.all([fetchConversations(), fetchFriends()]);
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isBanned, broadcastUnreadTotal, fetchConversations, fetchFriends, isPublicOnly, termsAccepted]);

  useEffect(() => {
    if (!termsAccepted || isBanned || !selectedId) return;
    if (messagesByConvRef.current[selectedId] !== undefined) {
      void markRead(selectedId);
      return;
    }
    const timer = window.setTimeout(() => {
      void loadMessages(selectedId);
      void markRead(selectedId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBanned, loadMessages, selectedId, termsAccepted]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingByConv((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [convId, map] of Object.entries(prev)) {
          const filtered: Record<string, { name: string; until: number }> = {};
          for (const [uid, entry] of Object.entries(map)) {
            if (entry.until > now) filtered[uid] = entry;
            else changed = true;
          }
          if (Object.keys(filtered).length > 0) next[convId] = filtered;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!termsAccepted || isBanned) return;
    let active = true;
    let releaseFn: (() => void) | null = null;
    const unsubs: Array<() => void> = [];
    let lastReconcileAt = 0;

    const reconcileSelectedMessages = async () => {
      const curId = selectedIdRef.current;
      if (!curId || !active) return;
      const curList = messagesByConvRef.current[curId] ?? [];
      const lastConfirmed = [...curList].reverse().find((m) => !m.optimisticState);
      if (!lastConfirmed) {
        void loadMessages(curId);
        return;
      }
      try {
        const res = await fetch(
          `/api/chat/realtime/backfill?conversationId=${encodeURIComponent(curId)}&afterMessageId=${encodeURIComponent(lastConfirmed.id)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: Array<{ messageId: string }>;
        };
        for (const item of data.items ?? []) {
          const mid = item.messageId;
          const msgRes = await fetch(`/api/chat/messages/${mid}`, { cache: "no-store" });
          if (!msgRes.ok) continue;
          const msgData = (await msgRes.json()) as { message?: ChatMessageItem };
          if (!msgData.message) continue;
          setMessagesByConv((prev) => {
            const list = prev[curId] ?? [];
            if (list.some((m) => m.id === msgData.message!.id)) return prev;
            return { ...prev, [curId]: [...list, msgData.message!] };
          });
        }
      } catch {}
    };

    void import("@/lib/chat/realtime/client").then(({ getChatRealtimeClient }) => {
      if (!active) return;
      const client = getChatRealtimeClient();
      clientRef.current = client;
      releaseFn = client.acquire();
      client.connectNow();

      unsubs.push(
        client.onPresence((ids) => {
          if (active) setOnlineUsers(new Set(ids));
        }),
      );

      const maxIso = (a: string | null | undefined, b: string): string => {
        if (!a) return b;
        return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
      };

      const patchMemberTimestamp = (
        convId: string,
        uid: string,
        field: "lastDeliveredAt" | "lastReadAt",
        ts: string,
      ) => {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const nextPeer =
              c.peer && c.peer.id === uid
                ? {
                    ...c.peer,
                    lastDeliveredAt:
                      field === "lastDeliveredAt" || field === "lastReadAt"
                        ? maxIso(c.peer.lastDeliveredAt, ts)
                        : c.peer.lastDeliveredAt,
                    lastReadAt:
                      field === "lastReadAt"
                        ? maxIso(c.peer.lastReadAt, ts)
                        : c.peer.lastReadAt,
                  }
                : c.peer;

            const existingStates = c.memberStates ?? [];
            const foundState = existingStates.some((m) => m.userId === uid);
            const nextStates = foundState
              ? existingStates.map((m) =>
                  m.userId === uid
                    ? {
                        ...m,
                        lastDeliveredAt:
                          field === "lastDeliveredAt" || field === "lastReadAt"
                            ? maxIso(m.lastDeliveredAt, ts)
                            : m.lastDeliveredAt,
                        lastReadAt:
                          field === "lastReadAt"
                            ? maxIso(m.lastReadAt, ts)
                            : m.lastReadAt,
                      }
                    : m,
                )
              : [
                  ...existingStates,
                  {
                    userId: uid,
                    lastDeliveredAt: ts,
                    lastReadAt: field === "lastReadAt" ? ts : "",
                  },
                ];

            return {
              ...c,
              peer: nextPeer,
              memberStates: nextStates,
            };
          }),
        );
      };

      unsubs.push(
        client.onReconnect(async () => {
          void fetchConversations();
          if (!isPublicOnly) {
            void fetchFriends();
          }
          lastReconcileAt = Date.now();
          await reconcileSelectedMessages();
        }),
      );

      unsubs.push(
        client.onEvent(async (event) => {
          if (!active) return;

          if (event.type === "message.created") {
            const { conversationId, messageId } = event;
            if (
              messagesByConvRef.current[conversationId]?.some(
                (m) => m.id === messageId,
              )
            ) {
              return;
            }

            let incoming: ChatMessageItem | null = null;
            if (event.wire) {
              try {
                incoming = await decryptWireMessageToDto(event.wire);
              } catch {}
            }
            if (!incoming) {
              try {
                const res = await fetch(`/api/chat/messages/${messageId}`, {
                  cache: "no-store",
                });
                if (!res.ok) {
                  void fetchConversations();
                  return;
                }
                const data = (await res.json()) as { message?: ChatMessageItem };
                incoming = data.message ?? null;
              } catch {
                return;
              }
            }
            if (!incoming || !active) return;

            client.recordMessageSeen(conversationId, incoming.id, incoming.createdAt);
            if (
              incoming.senderId !== actor.id &&
              event.conversationType !== "PUBLIC"
            ) {
              scheduleDeliveryAck(conversationId, incoming.createdAt);
            }

            setMessagesByConv((prev) => {
              const list = prev[conversationId] ?? [];
              if (list.some((m) => m.id === incoming!.id)) return prev;
              const withoutOptimistic = incoming!.clientId
                ? list.filter((m) => m.clientId !== incoming!.clientId)
                : list;
              return { ...prev, [conversationId]: [...withoutOptimistic, incoming!] };
            });

            if (selectedIdRef.current === conversationId) {
              void markRead(conversationId, incoming.createdAt);
            }
            if (conversationsRef.current.some((c) => c.id === conversationId)) {
              setConversations((prev) => {
                const next = prev.map((c) => {
                  if (c.id !== conversationId) return c;
                  const isCurrent = selectedIdRef.current === conversationId;
                  return {
                    ...c,
                    lastMessageAt: incoming!.createdAt,
                    lastMessage: {
                      id: incoming!.id,
                      type: incoming!.type,
                      body: incoming!.body,
                      createdAt: incoming!.createdAt,
                      senderId: incoming!.senderId,
                      senderName: incoming!.sender?.name ?? null,
                      deleted: incoming!.deleted,
                    },
                    unreadCount:
                      isCurrent || incoming!.senderId === actor.id
                        ? 0
                        : c.unreadCount + 1,
                  };
                });
                broadcastUnreadTotal(next);
                return next;
              });
            } else {
              void fetchConversations();
            }
            return;
          }

          if (event.type === "message.deleted") {
            const { conversationId, messageId } = event;
            setMessagesByConv((prev) => ({
              ...prev,
              [conversationId]: (prev[conversationId] ?? []).map((m) =>
                m.id === messageId ? { ...m, deleted: true, body: "" } : m,
              ),
            }));
            void fetchConversations();
            return;
          }

          if (event.type === "message.updated") {
            const { conversationId, messageId } = event;
            let updated: ChatMessageItem | null = null;
            if (event.wire) {
              try {
                updated = await decryptWireMessageToDto(event.wire);
              } catch {}
            }
            if (!updated) {
              try {
                const res = await fetch(`/api/chat/messages/${messageId}`, {
                  cache: "no-store",
                });
                if (!res.ok) return;
                const data = (await res.json()) as { message?: ChatMessageItem };
                updated = data.message ?? null;
              } catch {
                return;
              }
            }
            if (!updated || !active) return;
            setMessagesByConv((prev) => ({
              ...prev,
              [conversationId]: (prev[conversationId] ?? []).map((m) =>
                m.id === updated!.id ? updated! : m,
              ),
            }));
            void fetchConversations();
            return;
          }

          if (event.type === "typing") {
            if (event.userId === actor.id) return;
            const knownFriend = friendsRef.current.friends.find((f) => f.id === event.userId);
            const knownPeer = conversationsRef.current.find(
              (c) => c.peer?.id === event.userId,
            )?.peer;
            const knownSender = (messagesByConvRef.current[event.conversationId] ?? []).find(
              (m) => m.senderId === event.userId,
            )?.sender;
            const displayName =
              knownFriend?.name ||
              knownPeer?.name ||
              knownSender?.name ||
              t("chatInvite.unknownInviter");
            setTypingByConv((prev) => {
              const curMap = { ...(prev[event.conversationId] ?? {}) };
              if (event.isTyping) {
                curMap[event.userId] = {
                  name: displayName,
                  until: Date.now() + 3600,
                };
              } else {
                delete curMap[event.userId];
              }
              return { ...prev, [event.conversationId]: curMap };
            });
            return;
          }

          if (event.type === "delivered") {
            if (event.userId !== actor.id) {
              patchMemberTimestamp(
                event.conversationId,
                event.userId,
                "lastDeliveredAt",
                event.lastDeliveredAt,
              );
            }
            return;
          }

          if (event.type === "read") {
            if (event.userId !== actor.id) {
              patchMemberTimestamp(
                event.conversationId,
                event.userId,
                "lastReadAt",
                event.lastReadAt,
              );
            }
            return;
          }

          if (event.type === "friend.changed") {
            if (event.kind === "requested") {
              notify.info(
                t("chat.toastFriendRequest").replace("{name}", t("chatInvite.unknownInviter")),
              );
            }
            void fetchFriends();
            void fetchConversations();
            return;
          }

          if (event.type === "invite.received") {
            notify.info(t("chatInvite.badge"));
            void fetchConversations();
            return;
          }

          if (event.type === "invite.updated") {
            setMessagesByConv((prev) => {
              let changed = false;
              const next: typeof prev = {};
              for (const [cid, list] of Object.entries(prev)) {
                const updatedList = list.map((m) => {
                  if (m.invite?.id !== event.inviteId) return m;
                  changed = true;
                  return {
                    ...m,
                    invite: {
                      ...m.invite,
                      status: event.status,
                    },
                  };
                });
                next[cid] = updatedList;
              }
              return changed ? next : prev;
            });
            void fetchConversations();
            if (event.status === "ACCEPTED") {
              void client.refreshSubscriptions();
            }
            return;
          }

          if (
            event.type === "member.changed" ||
            event.type === "unread.sync"
          ) {
            void fetchConversations();
            if (event.type === "member.changed") {
              if (event.action === "removed" || event.action === "left") {
                clearClientConversationKeys(event.conversationId);
              }
              if (
                event.action === "moderation" ||
                event.action === "banned" ||
                event.action === "unbanned"
              ) {
                router.refresh();
                return;
              }
              void client.refreshSubscriptions();
              if (selectedIdRef.current === event.conversationId) {
                void loadMessages(event.conversationId);
              }
            }
          }
        }),
      );
    });

    const onVisibility = () => {
      if (document.visibilityState === "visible" && active) {
        void fetchConversations();
        if (!isPublicOnly) {
          void fetchFriends();
        }
        if (Date.now() - lastReconcileAt >= 3000) {
          lastReconcileAt = Date.now();
          void reconcileSelectedMessages();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible" && active) {
        void fetchConversations();
        if (!isPublicOnly) {
          void fetchFriends();
        }
      }
    }, 60_000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(heartbeat);
      for (const unsub of unsubs) unsub();
      if (releaseFn) releaseFn();
    };
  }, [
    actor.id,
    isBanned,
    broadcastUnreadTotal,
    fetchConversations,
    fetchFriends,
    loadMessages,
    markRead,
    router,
    t,
    termsAccepted,
  ]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const selectedMessages = selectedId ? messagesByConv[selectedId] ?? [] : [];
  const hasMoreForSelected = Boolean(selectedId && cursorByConv[selectedId]);
  const typingNames = useMemo(() => {
    if (!selectedId) return [];
    const map = typingByConv[selectedId] ?? {};
    return Object.values(map).map((entry) => entry.name);
  }, [selectedId, typingByConv]);

  async function handleSendMessage(text: string, replyToId: string | null) {
    if (!selectedId) return;
    const clientId = makeClientId();
    const replyTarget = replyToId
      ? selectedMessages.find((m) => m.id === replyToId) ?? null
      : null;

    const optimisticMsg: ChatMessageItem = {
      id: `opt_${clientId}`,
      clientId,
      conversationId: selectedId,
      senderId: actor.id,
      sender: {
        id: actor.id,
        name: actor.name,
        image: actor.image,
        isOnline: actor.showOnlineStatus,
      },
      isAnonymized: false,
      type: "TEXT",
      body: text,
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            senderId: replyTarget.senderId,
            senderName: replyTarget.sender?.name ?? null,
            body: replyTarget.body,
            deleted: replyTarget.deleted,
          }
        : null,
      invite: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deleted: false,
      optimisticState: "sending",
    };

    setMessagesByConv((prev) => ({
      ...prev,
      [selectedId]: [...(prev[selectedId] ?? []), optimisticMsg],
    }));

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          body: text,
          replyToId,
          clientId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: ChatMessageItem;
        error?: string;
      };
      if (!res.ok || !data.message) {
        setMessagesByConv((prev) => ({
          ...prev,
          [selectedId]: (prev[selectedId] ?? []).map((m) =>
            m.clientId === clientId ? { ...m, optimisticState: "failed" } : m,
          ),
        }));
        if (data.error) notify.error(data.error);
        return;
      }

      const saved = data.message;
      setMessagesByConv((prev) => {
        const list = prev[selectedId] ?? [];
        const withoutDuplicate = list.filter(
          (m) => m.id !== saved.id && m.clientId !== clientId,
        );
        return { ...prev, [selectedId]: [...withoutDuplicate, saved] };
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                lastMessageAt: saved.createdAt,
                lastMessage: {
                  id: saved.id,
                  type: saved.type,
                  body: saved.body,
                  createdAt: saved.createdAt,
                  senderId: saved.senderId,
                  senderName: saved.sender?.name ?? null,
                  deleted: saved.deleted,
                },
              }
            : c,
        ),
      );
    } catch {
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.clientId === clientId ? { ...m, optimisticState: "failed" } : m,
        ),
      }));
    }
  }

  async function handleRetryMessage(msg: ChatMessageItem) {
    setMessagesByConv((prev) => ({
      ...prev,
      [msg.conversationId]: (prev[msg.conversationId] ?? []).filter(
        (m) => m.id !== msg.id,
      ),
    }));
    await handleSendMessage(msg.body, msg.replyTo?.id ?? null);
  }

  async function handleEditMessage(messageId: string, body: string) {
    const res = await fetch(`/api/chat/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return false;
    }
    const data = (await res.json()) as { message?: ChatMessageItem };
    if (data.message && selectedId) {
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.id === messageId ? data.message! : m,
        ),
      }));
    }
    return true;
  }

  async function handleDeleteMessage(messageId: string) {
    const res = await fetch(`/api/chat/messages/${messageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return;
    }
    if (selectedId) {
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.id === messageId ? { ...m, deleted: true, body: "" } : m,
        ),
      }));
    }
  }

  async function handleModeratorDeleteMessage(messageId: string) {
    const res = await fetch(`/api/admin/moderation/messages/${messageId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Removed by moderator" }),
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return;
    }
    if (selectedId) {
      setMessagesByConv((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] ?? []).map((m) =>
          m.id === messageId ? { ...m, deleted: true, body: "" } : m,
        ),
      }));
    }
  }

  async function handleRespondInvite(inviteId: string, action: "accept" | "decline") {
    const prevSelected = selectedIdRef.current;
    const res = await fetch(`/api/chat/invites/message/${inviteId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: action }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      roomId?: string;
      error?: string;
    };
    if (!res.ok) {
      notify.error(data.error || t("chat.actionError"));
      return;
    }
    if (action === "accept" && data.roomId) {
      if (isPublicOnly) {
        router.push(`/messages?tab=rooms&c=${encodeURIComponent(data.roomId)}`);
        return;
      }
      await fetchConversations();
      if (selectedIdRef.current === prevSelected) {
        setActiveTab("rooms");
        setSelectedId(data.roomId);
        setMobilePane("thread");
      }
      return;
    }
    void fetchConversations();
  }

  async function handleFriendAction(
    action: "send" | "cancel" | "accept" | "decline" | "unfriend" | "block" | "unblock",
    targetUserId: string,
  ) {
    const res = await fetch("/api/chat/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetUserId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      notify.error(data.error || t("chat.actionError"));
      return;
    }
    await Promise.all([fetchFriends(), fetchConversations()]);
  }

  const handleOpenDm = useCallback(
    async (friendId: string) => {
      const existing = conversationsRef.current.find(
        (c) => c.type === "DM" && c.peer?.id === friendId,
      );
      if (existing) {
        setActiveTab("friends");
        setSelectedId(existing.id);
        setMobilePane("thread");
        return;
      }

      const res = await fetch("/api/chat/conversations/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: friendId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        conversation?: ChatConversationSummary;
        conversationId?: string;
        error?: string;
      };
      const conversationId = data.conversation?.id ?? data.conversationId;
      if (!res.ok || !conversationId) {
        notify.error(data.error || t("chat.actionError"));
        return;
      }
      if (data.conversation) {
        const createdConv = data.conversation;
        setConversations((prev) => {
          if (prev.some((c) => c.id === createdConv.id)) return prev;
          return [createdConv, ...prev];
        });
      } else {
        void fetchConversations();
      }
      setActiveTab("friends");
      setSelectedId(conversationId);
      setMobilePane("thread");
    },
    [fetchConversations, t],
  );

  const dmInitDoneRef = useRef(false);
  useEffect(() => {
    if (
      isPublicOnly ||
      !initialDmPeerId ||
      dmInitDoneRef.current ||
      !termsAccepted ||
      isBanned
    ) {
      return;
    }
    dmInitDoneRef.current = true;
    const timer = window.setTimeout(() => {
      void handleOpenDm(initialDmPeerId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBanned, handleOpenDm, initialDmPeerId, isPublicOnly, termsAccepted]);

  const handleTabChange = useCallback((nextTab: ChatTab) => {
    setActiveTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  async function handleToggleMute(conversationId: string, muted: boolean) {
    const res = await fetch(`/api/chat/conversations/${conversationId}/mute`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ muted }),
    });
    if (!res.ok) return;
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === conversationId ? { ...c, muted } : c));
      broadcastUnreadTotal(next);
      return next;
    });
  }

  async function handleLeaveRoom(roomId: string) {
    const res = await fetch(`/api/chat/rooms/${roomId}/leave`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      notify.error(data.error || t("chat.actionError"));
      return;
    }
    setActiveTab("rooms");
    setSelectedId(null);
    setMobilePane("list");
    void fetchConversations();
  }

  useEffect(() => {
    if (!termsAccepted || isBanned) return;
    clientRef.current?.ensureSubscribedConversations(
      conversations.map((conv) => conv.id),
    );
  }, [isBanned, conversations, termsAccepted]);

  if (isBanned) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center px-4">
        <div
          data-testid="chat-banned-screen"
          className="glass-strong w-full rounded-3xl border border-destructive/30 p-6 text-center shadow-layered sm:p-8"
        >
          <h1 className="font-heading text-2xl font-bold text-destructive">
            {t("chat.bannedTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {bannedReason || t("chat.bannedDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (!termsAccepted) {
    return (
      <ChatTermsGate
        onAccepted={() => {
          setTermsAccepted(true);
          void fetchConversations();
          void fetchFriends();
          void clientRef.current?.refreshSubscriptions();
        }}
      />
    );
  }

  return (
    <div
      data-testid="chat-workspace"
      style={
        vvHeight
          ? ({ "--chat-vv-height": `${vvHeight}px` } as React.CSSProperties)
          : undefined
      }
      className={cn(
        styles.workspaceRoot,
        "mx-auto flex w-full max-w-7xl flex-col px-0 pb-0 md:px-4 md:pb-4",
      )}
    >
      <div
        data-testid="chat-surface"
        className={cn(
          styles.chatSurface,
          "grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-none border-t border-border/80 shadow-layered md:rounded-3xl md:border",
          isPublicOnly
            ? "grid-cols-1"
            : "md:grid-cols-[330px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]",
        )}
      >
        {!isPublicOnly ? (
          <div
            className={cn(
              "min-h-0 h-full",
              mobilePane === "thread" ? "hidden md:block" : "block",
            )}
          >
            <ChatSidebar
              currentUserId={actor.id}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              conversations={conversations}
              selectedConversationId={selectedId}
              onSelectConversation={(cid) => {
                setSelectedId(cid);
                setMobilePane("thread");
              }}
              friendsData={friendsData}
              onlineUsers={onlineUsers}
              onOpenDm={(fid) => void handleOpenDm(fid)}
              onFriendAction={handleFriendAction}
              onOpenCreateRoom={() => setCreateRoomOpen(true)}
            />
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0 h-full",
            !isPublicOnly && mobilePane === "list" ? "hidden md:block" : "block",
          )}
        >
          <ChatConversationPane
            conversation={selectedConversation}
            currentUserId={actor.id}
            messages={selectedMessages}
            loadingMessages={loadingConvId === selectedId}
            loadingOlder={loadingOlder}
            hasMore={hasMoreForSelected}
            typingNames={typingNames}
            onlineUsers={onlineUsers}
            publicTimeoutUntil={actor.chatPublicTimeoutUntil}
            showMobileBack={!isPublicOnly && mobilePane === "thread"}
            onMobileBack={() => setMobilePane("list")}
            onLoadOlder={() => {
              if (!selectedId || !cursorByConv[selectedId] || loadingOlder) return;
              setLoadingOlder(true);
              void loadMessages(selectedId, cursorByConv[selectedId]).finally(() =>
                setLoadingOlder(false),
              );
            }}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onRespondInvite={handleRespondInvite}
            onToggleMute={handleToggleMute}
            onOpenRoomPanel={() => setRoomPanelOpen(true)}
            onLeaveRoom={handleLeaveRoom}
            onFriendAction={handleFriendAction}
            onTypingPulse={() => {
              if (selectedId && clientRef.current) {
                clientRef.current.sendTyping(selectedId, true);
              }
            }}
            onReportMessage={(msg) => setReportTarget(msg)}
            onModeratorDeleteMessage={
              actor.role === "ADMIN" || actor.role === "MODERATOR"
                ? handleModeratorDeleteMessage
                : undefined
            }
          />
        </div>
      </div>

      <ReportMessageDialog
        message={reportTarget}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
      />

      <CreateRoomDialog
        open={createRoomOpen}
        onOpenChange={setCreateRoomOpen}
        friends={friendsData.friends}
        onCreated={(roomId) => {
          setActiveTab("rooms");
          setMobilePane("thread");
          void fetchConversations().then(() => {
            setSelectedId(roomId);
          });
        }}
      />

      <RoomMembersSheet
        roomId={selectedConversation?.type === "ROOM" ? selectedConversation.id : null}
        open={roomPanelOpen}
        onOpenChange={setRoomPanelOpen}
        currentUserId={actor.id}
        friends={friendsData.friends}
        onRoomUpdated={() => void fetchConversations()}
        onRoomLeftOrDeleted={() => {
          setRoomPanelOpen(false);
          setActiveTab("rooms");
          setSelectedId(null);
          setMobilePane("list");
          void fetchConversations();
        }}
      />
    </div>
  );
}
