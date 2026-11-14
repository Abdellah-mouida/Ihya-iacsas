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
  initialTermsAccepted,
  initialConversationId,
  initialConversations,
  initialFriends,
  bannedReason,
}: {
  actor: ChatActorInfo;
  initialTermsAccepted: boolean;
  initialConversationId: string | null;
  initialConversations?: ChatConversationSummary[];
  initialFriends?: FriendsDashboardState;
  bannedReason?: string | null;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [termsAccepted, setTermsAccepted] = useState(initialTermsAccepted);
  const [activeTab, setActiveTab] = useState<ChatTab>("public");
  const [conversations, setConversations] = useState<ChatConversationSummary[]>(
    initialConversations ?? [],
  );
  const [friendsData, setFriendsData] = useState<FriendsDashboardState>(
    initialFriends ?? EMPTY_FRIENDS,
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      initialConversationId ??
      initialConversations?.find((c) => c.type === "PUBLIC")?.id ??
      initialConversations?.[0]?.id ??
      null,
  );
  const [mobilePane, setMobilePane] = useState<"list" | "thread">(
    initialConversationId ? "thread" : "list",
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
  }, [selectedId]);

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
    return () => vv.removeEventListener("resize", update);
  }, []);

  const broadcastUnreadTotal = useCallback((convs: ChatConversationSummary[]) => {
    const total = convs.reduce((sum, c) => sum + (c.muted ? 0 : c.unreadCount), 0);
    window.dispatchEvent(
      new CustomEvent("ihyaa_chat_unread", { detail: { total } }),
    );
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/chat/conversations", { cache: "no-store" });
    if (!res.ok) return [] as ChatConversationSummary[];
    const data = (await res.json()) as { conversations?: ChatConversationSummary[] };
    const list = data.conversations ?? [];
    setConversations(list);
    broadcastUnreadTotal(list);
    setSelectedId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev;
      return list.find((c) => c.type === "PUBLIC")?.id ?? list[0]?.id ?? null;
    });
    return list;
  }, [broadcastUnreadTotal]);

  const fetchFriends = useCallback(async () => {
    const res = await fetch("/api/chat/friends", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as FriendsDashboardState;
    setFriendsData(data);
  }, []);

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
        const params = new URLSearchParams({ conversationId, limit: "30" });
        if (before) params.set("cursor", before);
        const res = await fetch(`/api/chat/messages?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages?: ChatMessageItem[];
          nextCursor?: string | null;
        };
        const fetched = (data.messages ?? []).slice().reverse();
        setCursorByConv((prev) => ({ ...prev, [conversationId]: data.nextCursor ?? null }));
        setMessagesByConv((prev) => {
          const existing = prev[conversationId] ?? [];
          if (before) {
            const seenIds = new Set(existing.map((m) => m.id));
            const merged = [...fetched.filter((m) => !seenIds.has(m.id)), ...existing];
            return { ...prev, [conversationId]: merged };
          }
          const pending = existing.filter((m) => m.optimisticState);
          return { ...prev, [conversationId]: [...fetched, ...pending] };
        });

        if (!before && fetched.length > 0 && selectedIdRef.current === conversationId) {
          void markRead(conversationId, fetched[fetched.length - 1].createdAt);
        }
      } finally {
        if (!before) setLoadingConvId((cur) => (cur === conversationId ? null : cur));
      }
    },
    [markRead],
  );

  const seededFromServerRef = useRef(
    Boolean(initialConversations && initialFriends),
  );

  useEffect(() => {
    if (!termsAccepted || bannedReason !== undefined) return;
    if (seededFromServerRef.current) {
      seededFromServerRef.current = false;
      broadcastUnreadTotal(conversationsRef.current);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      void Promise.all([fetchConversations(), fetchFriends()]);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bannedReason, broadcastUnreadTotal, fetchConversations, fetchFriends, termsAccepted]);

  useEffect(() => {
    if (!termsAccepted || bannedReason !== undefined || !selectedId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      void loadMessages(selectedId);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bannedReason, loadMessages, selectedId, termsAccepted]);

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
    if (!termsAccepted || bannedReason !== undefined) return;
    let active = true;
    let releaseFn: (() => void) | null = null;
    const unsubs: Array<() => void> = [];

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

      unsubs.push(
        client.onReconnect(async () => {
          const curId = selectedIdRef.current;
          if (!curId) return;
          const curList = messagesByConvRef.current[curId] ?? [];
          const lastConfirmed = [...curList].reverse().find((m) => !m.optimisticState);
          if (!lastConfirmed) {
            return;
          }
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
            const res = await fetch(`/api/chat/messages/${messageId}`, {
              cache: "no-store",
            });
            if (!res.ok) {
              void fetchConversations();
              return;
            }
            const data = (await res.json()) as { message?: ChatMessageItem };
            const incoming = data.message;
            if (!incoming) return;

            client.recordMessageSeen(conversationId, incoming.id);
            setMessagesByConv((prev) => {
              const list = prev[conversationId] ?? [];
              if (list.some((m) => m.id === incoming.id)) return prev;
              const withoutOptimistic = incoming.clientId
                ? list.filter((m) => m.clientId !== incoming.clientId)
                : list;
              return { ...prev, [conversationId]: [...withoutOptimistic, incoming] };
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
                    lastMessageAt: incoming.createdAt,
                    lastMessage: {
                      id: incoming.id,
                      type: incoming.type,
                      body: incoming.body,
                      createdAt: incoming.createdAt,
                      senderId: incoming.senderId,
                      senderName: incoming.sender?.name ?? null,
                      deleted: incoming.deleted,
                    },
                    unreadCount:
                      isCurrent || incoming.senderId === actor.id
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
            const res = await fetch(`/api/chat/messages/${messageId}`, {
              cache: "no-store",
            });
            if (!res.ok) return;
            const data = (await res.json()) as { message?: ChatMessageItem };
            const updated = data.message;
            if (!updated) return;
            setMessagesByConv((prev) => ({
              ...prev,
              [conversationId]: (prev[conversationId] ?? []).map((m) =>
                m.id === updated.id ? updated : m,
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

          if (event.type === "read") {
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== event.conversationId || !c.peer) return c;
                if (c.peer.id !== event.userId) return c;
                return { ...c, peer: { ...c.peer, lastReadAt: event.lastReadAt } };
              }),
            );
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

          if (
            event.type === "invite.updated" ||
            event.type === "member.changed" ||
            event.type === "unread.sync"
          ) {
            void fetchConversations();
            if (event.type === "member.changed") {
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

    return () => {
      active = false;
      for (const unsub of unsubs) unsub();
      if (releaseFn) releaseFn();
    };
  }, [
    actor.id,
    bannedReason,
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
    await fetchConversations();
    if (selectedId) await loadMessages(selectedId);
    if (action === "accept" && data.roomId) {
      setActiveTab("rooms");
      setSelectedId(data.roomId);
      setMobilePane("thread");
    }
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

  async function handleOpenDm(friendId: string) {
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
  }

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

  useEffect(() => {
    if (!termsAccepted || bannedReason !== undefined) return;
    clientRef.current?.ensureSubscribedConversations(
      conversations.map((conv) => conv.id),
    );
  }, [bannedReason, conversations, termsAccepted]);

  if (bannedReason !== undefined) {
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
        "mx-auto flex w-full max-w-7xl flex-col px-2 pb-2 sm:px-4 sm:pb-4",
      )}
    >
      <div className="glass-strong grid min-h-0 flex-1 overflow-hidden rounded-3xl border border-border/80 shadow-layered md:grid-cols-[330px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)]">
        <div
          className={cn(
            "min-h-0",
            mobilePane === "thread" ? "hidden md:block" : "block",
          )}
        >
          <ChatSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
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

        <div
          className={cn(
            "min-h-0",
            mobilePane === "list" ? "hidden md:block" : "block",
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
            showMobileBack={mobilePane === "thread"}
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
          void fetchConversations();
          setActiveTab("rooms");
          setSelectedId(roomId);
          setMobilePane("thread");
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
          setActiveTab("public");
          setSelectedId(
            conversations.find((c) => c.type === "PUBLIC")?.id ?? null,
          );
          setMobilePane("list");
          void fetchConversations();
        }}
      />
    </div>
  );
}
