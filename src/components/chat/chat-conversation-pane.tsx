"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Flag,
  Pencil,
  Reply,
  RotateCw,
  Send,
  Smile,
  Trash2,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { ClickSpark } from "@/components/common/click-spark";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { parseSafeMessageSegments } from "@/lib/chat/links";
import { cn } from "@/lib/utils";
import {
  type ChatConversationSummary,
  type ChatMessageItem,
  CURATED_CHAT_EMOJIS,
  getRoomAccentStyle,
} from "./chat-types";
import styles from "./chat-workspace.module.css";

const WINDOW_OVERSCAN = 18;
const DEFAULT_ROW_HEIGHT = 76;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function ChatConversationPane({
  conversation,
  currentUserId,
  messages,
  loadingMessages,
  loadingOlder,
  hasMore,
  typingNames,
  onlineUsers,
  publicTimeoutUntil,
  showMobileBack,
  onMobileBack,
  onLoadOlder,
  onSendMessage,
  onRetryMessage,
  onEditMessage,
  onDeleteMessage,
  onRespondInvite,
  onToggleMute,
  onOpenRoomPanel,
  onFriendAction,
  onTypingPulse,
  onReportMessage,
  onModeratorDeleteMessage,
}: {
  conversation: ChatConversationSummary | null;
  currentUserId: string;
  messages: ChatMessageItem[];
  loadingMessages: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  typingNames: string[];
  onlineUsers: Set<string>;
  publicTimeoutUntil: string | null;
  showMobileBack: boolean;
  onMobileBack: () => void;
  onLoadOlder: () => void;
  onSendMessage: (text: string, replyToId: string | null) => Promise<void>;
  onRetryMessage: (msg: ChatMessageItem) => Promise<void>;
  onEditMessage: (messageId: string, body: string) => Promise<boolean>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onRespondInvite: (inviteId: string, action: "accept" | "decline") => Promise<void>;
  onToggleMute: (conversationId: string, muted: boolean) => Promise<void>;
  onOpenRoomPanel: () => void;
  onFriendAction: (action: "unfriend" | "block", targetUserId: string) => Promise<void>;
  onTypingPulse: () => void;
  onReportMessage?: (msg: ChatMessageItem) => void;
  onModeratorDeleteMessage?: (messageId: string) => Promise<void>;
}) {
  const { t, locale, dir } = useLocale();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [nowMs, setNowMs] = useState(0);
  const [scrollWindow, setScrollWindow] = useState({
    start: 0,
    end: 80,
    topSpacer: 0,
    bottomSpacer: 0,
  });
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevLenRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const loadingOlderLockRef = useRef(false);
  const heightCacheRef = useRef<Map<string, number>>(new Map());

  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;
  const intlLocale = locale === "ar" ? "ar-MA" : "en-US";

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [intlLocale],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [intlLocale],
  );

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    const raf = window.requestAnimationFrame(updateNow);
    const interval = window.setInterval(updateNow, 15_000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, []);

  const computeSpacers = useCallback(
    (start: number, end: number) => {
      let top = 0;
      for (let i = 0; i < start; i += 1) {
        top += heightCacheRef.current.get(messages[i].id) ?? DEFAULT_ROW_HEIGHT;
      }
      let bottom = 0;
      for (let i = end; i < messages.length; i += 1) {
        bottom += heightCacheRef.current.get(messages[i].id) ?? DEFAULT_ROW_HEIGHT;
      }
      return { topSpacer: top, bottomSpacer: bottom };
    },
    [messages],
  );

  const updateWindowFromScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    setAtBottom(nearBottom);

    if (el.scrollTop < 120 && hasMore && !loadingOlder && !loadingOlderLockRef.current) {
      loadingOlderLockRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      onLoadOlder();
    }

    if (messages.length <= 60) {
      setScrollWindow({ start: 0, end: messages.length, topSpacer: 0, bottomSpacer: 0 });
      return;
    }

    const avgRow = DEFAULT_ROW_HEIGHT;
    const visibleCount = Math.max(12, Math.ceil(el.clientHeight / avgRow));
    const approxFirst = Math.floor(el.scrollTop / avgRow);
    const start = Math.max(0, approxFirst - WINDOW_OVERSCAN);
    const end = Math.min(messages.length, approxFirst + visibleCount + WINDOW_OVERSCAN);
    const { topSpacer, bottomSpacer } = computeSpacers(start, end);
    setScrollWindow((prev) =>
      prev.start === start &&
      prev.end === end &&
      prev.topSpacer === topSpacer &&
      prev.bottomSpacer === bottomSpacer
        ? prev
        : { start, end, topSpacer, bottomSpacer },
    );
  }, [computeSpacers, hasMore, loadingOlder, messages.length, onLoadOlder]);

  useEffect(() => {
    if (!loadingOlder) {
      loadingOlderLockRef.current = false;
    }
  }, [loadingOlder]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !conversation) return;

    const switchedConv = prevConvIdRef.current !== conversation.id;
    const lenDelta = messages.length - prevLenRef.current;

    if (switchedConv) {
      prevConvIdRef.current = conversation.id;
      heightCacheRef.current.clear();
      el.scrollTop = el.scrollHeight;
      queueMicrotask(() => {
        setReplyTo(null);
        setEditingId(null);
        setEmojiOpen(false);
        setAtBottom(true);
        const start = messages.length <= 60 ? 0 : Math.max(0, messages.length - 50);
        const end = messages.length;
        const { topSpacer, bottomSpacer } = computeSpacers(start, end);
        setScrollWindow({ start, end, topSpacer, bottomSpacer });
      });
    } else if (prevScrollHeightRef.current > 0 && lenDelta > 0 && !atBottom) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      if (diff > 0) {
        el.scrollTop += diff;
      }
      prevScrollHeightRef.current = 0;
    } else if (lenDelta > 0 && atBottom) {
      el.scrollTop = el.scrollHeight;
      queueMicrotask(() => {
        const start = messages.length <= 60 ? 0 : Math.max(0, messages.length - 50);
        const end = messages.length;
        const { topSpacer, bottomSpacer } = computeSpacers(start, end);
        setScrollWindow({ start, end, topSpacer, bottomSpacer });
      });
    }

    prevLenRef.current = messages.length;
  }, [atBottom, computeSpacers, conversation, messages.length]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
  }, [draft]);

  function scrollToBottom() {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  }

  async function submitDraft() {
    const text = draft.trim();
    if (!text || !conversation) return;
    const replyId = replyTo?.id ?? null;
    setDraft("");
    setReplyTo(null);
    setEmojiOpen(false);
    setAtBottom(true);
    await onSendMessage(text, replyId);
  }

  async function handleDelete(msg: ChatMessageItem) {
    const ok = await confirm({
      title: t("chat.deleteMessageTitle"),
      description: t("chat.deleteMessageDesc"),
      variant: "destructive",
    });
    if (!ok) return;
    await onDeleteMessage(msg.id);
  }

  async function handleSaveEdit(messageId: string) {
    const trimmed = editingDraft.trim();
    if (!trimmed) return;
    const ok = await onEditMessage(messageId, trimmed);
    if (ok) {
      setEditingId(null);
      setEditingDraft("");
    }
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-heading text-lg font-bold text-foreground">
          {t("chat.selectConversation")}
        </p>
      </div>
    );
  }

  const isPublic = conversation.type === "PUBLIC";
  const isDm = conversation.type === "DM";
  const isRoom = conversation.type === "ROOM";

  const timeoutActive = Boolean(
    isPublic &&
      publicTimeoutUntil &&
      nowMs > 0 &&
      new Date(publicTimeoutUntil).getTime() > nowMs,
  );

  const peerOnline =
    isDm &&
    conversation.peer &&
    conversation.peer.isOnline !== null &&
    Boolean(conversation.peer.isOnline || onlineUsers.has(conversation.peer.id));

  const title = isPublic
    ? t("chat.publicSpaceTitle")
    : isDm
    ? conversation.peer?.name || t("chatInvite.unknownInviter")
    : conversation.name || t("chat.tabRooms");

  const startIndex = messages.length <= 60 ? 0 : Math.max(0, scrollWindow.start);
  const endIndex =
    messages.length <= 60 ? messages.length : Math.min(messages.length, scrollWindow.end);
  const visibleMessages = messages.slice(startIndex, endIndex);

  const topSpacer = messages.length <= 60 ? 0 : scrollWindow.topSpacer;
  const bottomSpacer = messages.length <= 60 ? 0 : scrollWindow.bottomSpacer;

  const accent = getRoomAccentStyle(conversation.accentColor);

  return (
    <section
      data-testid="chat-conversation-pane"
      className="flex h-full min-h-0 flex-col bg-background/40"
    >
      {ConfirmDialogComponent}

      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card/75 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {showMobileBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="chat-mobile-back-btn"
              onClick={onMobileBack}
              aria-label={t("chat.backToList")}
              className="size-9 shrink-0 rounded-xl md:hidden"
            >
              <BackIcon className="size-5" />
            </Button>
          ) : null}

          {isDm && conversation.peer ? (
            <Link
              href={`/u/${conversation.peer.id}`}
              className="flex min-w-0 items-center gap-2.5 hover:opacity-85"
            >
              <div className="relative shrink-0">
                <UserAvatar user={conversation.peer} size="sm" shape="circle" />
                {peerOnline ? (
                  <span
                    data-online="true"
                    className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card bg-green"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-bold text-foreground sm:text-base">
                  {title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {peerOnline ? t("friends.online") : t("friends.offline")}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl border text-base",
                  isRoom ? accent.badge : "border-primary/25 bg-primary/10",
                )}
              >
                {conversation.emoji || "🌙"}
              </span>
              <div className="min-w-0">
                <p className="truncate font-heading text-sm font-bold text-foreground sm:text-base">
                  {title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {isPublic
                    ? t("chat.publicSpaceDesc")
                    : t("chat.membersCount").replace(
                        "{count}",
                        String(conversation.memberCount),
                      )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="chat-mute-toggle-btn"
            onClick={() => void onToggleMute(conversation.id, !conversation.muted)}
            aria-label={conversation.muted ? t("chat.unmuteRoom") : t("chat.muteRoom")}
            title={conversation.muted ? t("chat.unmuteRoom") : t("chat.muteRoom")}
            className="size-9 rounded-xl text-muted-foreground hover:text-foreground"
          >
            {conversation.muted ? (
              <BellOff className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}
          </Button>

          {isRoom ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="chat-room-members-btn"
              onClick={onOpenRoomPanel}
              className="h-9 rounded-xl px-2.5 text-xs font-semibold"
            >
              <Users className="size-4 me-1.5" />
              <span className="hidden sm:inline">{t("chat.membersBtn")}</span>
            </Button>
          ) : null}

          {isDm && conversation.peer ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("friends.unfriendConfirmTitle"),
                    description: t("friends.unfriendConfirmDesc"),
                    variant: "destructive",
                  });
                  if (ok && conversation.peer) {
                    await onFriendAction("unfriend", conversation.peer.id);
                  }
                }}
                aria-label={t("friends.unfriend")}
                title={t("friends.unfriend")}
                className="size-9 rounded-xl text-muted-foreground hover:text-destructive"
              >
                <UserMinus className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("friends.blockConfirmTitle"),
                    description: t("friends.blockConfirmDesc"),
                    variant: "destructive",
                  });
                  if (ok && conversation.peer) {
                    await onFriendAction("block", conversation.peer.id);
                  }
                }}
                aria-label={t("friends.blockUser")}
                title={t("friends.blockUser")}
                className="size-9 rounded-xl text-muted-foreground hover:text-destructive"
              >
                <Ban className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={updateWindowFromScroll}
          data-testid="chat-messages-scroll"
          className="h-full overflow-y-auto px-3 py-4 sm:px-5"
        >
          {loadingOlder ? (
            <p className="pb-3 text-center text-xs text-muted-foreground">
              {t("chat.loadingMessages")}
            </p>
          ) : null}

          {loadingMessages && messages.length === 0 ? (
            <div className="space-y-3 py-8">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={cn(
                    "h-14 w-3/5 animate-pulse rounded-2xl bg-muted/50",
                    idx % 2 === 1 ? "ms-auto" : "",
                  )}
                />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {t("chat.noMessages")}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {topSpacer > 0 ? <div style={{ height: topSpacer }} aria-hidden="true" /> : null}

              {visibleMessages.map((msg, localIdx) => {
                const absIndex = startIndex + localIdx;
                const prev = absIndex > 0 ? messages[absIndex - 1] : null;
                const showDay = !prev || dayKey(prev.createdAt) !== dayKey(msg.createdAt);

                const own = msg.senderId === currentUserId;
                const sameGroup =
                  !showDay &&
                  prev &&
                  prev.type === "TEXT" &&
                  msg.type === "TEXT" &&
                  prev.senderId === msg.senderId &&
                  new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() <
                    3 * 60_000;

                const peerReadAt = conversation.peer?.lastReadAt
                  ? new Date(conversation.peer.lastReadAt).getTime()
                  : 0;
                const isSeenInDm =
                  isDm && own && !msg.optimisticState && peerReadAt >= new Date(msg.createdAt).getTime();

                const senderName = msg.isAnonymized
                  ? t("chat.anonymizedAuthor")
                  : msg.sender?.name || t("chatInvite.unknownInviter");

                const segments = parseSafeMessageSegments(msg.body);

                return (
                  <div
                    key={msg.id}
                    ref={(node) => {
                      if (node) {
                        const h = node.getBoundingClientRect().height;
                        if (h > 0) heightCacheRef.current.set(msg.id, h);
                      }
                    }}
                  >
                    {showDay ? (
                      <div className="my-3 flex items-center justify-center">
                        <span className="rounded-full border border-border/70 bg-card/85 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {dateFormatter.format(new Date(msg.createdAt))}
                        </span>
                      </div>
                    ) : null}

                    {msg.type === "SYSTEM" ? (
                      <div className="my-2 text-center text-xs text-muted-foreground">
                        {msg.body}
                      </div>
                    ) : msg.type === "ROOM_INVITE" && msg.invite ? (
                      <div
                        data-testid={`chat-invite-card-${msg.invite.id}`}
                        className={cn(
                          styles.inviteCardEnter,
                          "my-2 flex",
                          own ? "justify-end" : "justify-start",
                        )}
                      >
                        <div className="glass max-w-xs rounded-2xl border border-primary/30 p-3.5 shadow-sm sm:max-w-sm">
                          <div className="flex items-center gap-2.5">
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-base">
                              {msg.invite.roomEmoji || "💬"}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-primary">
                                {t("chatInvite.badge")}
                              </p>
                              <p className="truncate font-heading text-sm font-bold text-foreground">
                                {msg.invite.roomName || t("chat.tabRooms")}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {msg.invite.status === "PENDING" &&
                            msg.invite.inviteeId === currentUserId ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  data-testid={`invite-accept-${msg.invite.id}`}
                                  disabled={inviteBusyId === msg.invite.id}
                                  onClick={async () => {
                                    setInviteBusyId(msg.invite!.id);
                                    try {
                                      await onRespondInvite(msg.invite!.id, "accept");
                                    } finally {
                                      setInviteBusyId(null);
                                    }
                                  }}
                                  className="h-8 rounded-xl bg-primary px-3 text-xs text-primary-foreground"
                                >
                                  {t("chat.inviteAccept")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  data-testid={`invite-decline-${msg.invite.id}`}
                                  disabled={inviteBusyId === msg.invite.id}
                                  onClick={async () => {
                                    setInviteBusyId(msg.invite!.id);
                                    try {
                                      await onRespondInvite(msg.invite!.id, "decline");
                                    } finally {
                                      setInviteBusyId(null);
                                    }
                                  }}
                                  className="h-8 rounded-xl px-3 text-xs"
                                >
                                  {t("chat.inviteDecline")}
                                </Button>
                              </>
                            ) : (
                              <span className="rounded-lg border border-border/70 bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {msg.invite.status === "ACCEPTED"
                                  ? t("chat.inviteStatusAccepted")
                                  : msg.invite.status === "DECLINED"
                                  ? t("chat.inviteStatusDeclined")
                                  : msg.invite.status === "REVOKED"
                                  ? t("chat.inviteStatusRevoked")
                                  : msg.invite.status === "EXPIRED"
                                  ? t("chat.inviteStatusExpired")
                                  : t("chat.inviteStatusPending")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-testid={`chat-message-${msg.id}`}
                        className={cn(
                          styles.messageEnter,
                          "group flex items-end gap-2",
                          own ? "justify-end" : "justify-start",
                          sameGroup ? "mt-0.5" : "mt-2.5",
                        )}
                      >
                        {!own ? (
                          <div className="w-8 shrink-0">
                            {!sameGroup && msg.sender && !msg.isAnonymized ? (
                              <Link href={`/u/${msg.sender.id}`} className="block">
                                <UserAvatar
                                  user={msg.sender}
                                  size="sm"
                                  shape="circle"
                                />
                              </Link>
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "flex max-w-[82%] flex-col sm:max-w-[70%]",
                            own ? "items-end" : "items-start",
                          )}
                        >
                          {!own && !sameGroup ? (
                            msg.sender && !msg.isAnonymized ? (
                              <Link
                                href={`/u/${msg.sender.id}`}
                                className="mb-1 px-1 text-xs font-semibold text-primary hover:underline"
                              >
                                {senderName}
                              </Link>
                            ) : (
                              <span className="mb-1 px-1 text-xs font-semibold text-muted-foreground">
                                {senderName}
                              </span>
                            )
                          ) : null}

                          <div
                            className={cn(
                              "relative rounded-2xl border px-3.5 py-2 text-sm leading-relaxed break-words",
                              own
                                ? "rounded-ee-md border-primary/25 bg-primary text-primary-foreground"
                                : "rounded-es-md border-border/75 bg-card/90 text-foreground",
                              msg.optimisticState === "sending" ? "opacity-75" : "",
                              msg.optimisticState === "failed"
                                ? "border-destructive bg-destructive/15 text-foreground"
                                : "",
                            )}
                          >
                            {msg.replyTo ? (
                              <div
                                className={cn(
                                  "mb-1.5 rounded-xl border-s-2 px-2.5 py-1 text-xs",
                                  own
                                    ? "border-primary-foreground/50 bg-primary-foreground/10 text-primary-foreground/90"
                                    : "border-primary bg-muted/60 text-muted-foreground",
                                )}
                              >
                                <p className="font-semibold">
                                  {msg.replyTo.senderName || t("chat.anonymizedAuthor")}
                                </p>
                                <p dir="auto" className="truncate">
                                  {msg.replyTo.deleted
                                    ? t("chat.deletedMessage")
                                    : msg.replyTo.decryptionFailed
                                      ? t("chat.messageUnavailable")
                                      : msg.replyTo.body}
                                </p>
                              </div>
                            ) : null}

                            {editingId === msg.id ? (
                              <div className="space-y-2 min-w-48">
                                <textarea
                                  dir="auto"
                                  value={editingDraft}
                                  onChange={(e) => setEditingDraft(e.target.value)}
                                  maxLength={2000}
                                  rows={2}
                                  className="w-full resize-none rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingId(null)}
                                    className="h-7 px-2 text-xs text-foreground"
                                  >
                                    {t("chat.cancelEdit")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void handleSaveEdit(msg.id)}
                                    className="h-7 bg-primary px-2.5 text-xs text-primary-foreground"
                                  >
                                    {t("chat.saveEdit")}
                                  </Button>
                                </div>
                              </div>
                            ) : msg.deleted ? (
                              <p className="italic opacity-75">
                                {t("chat.deletedMessage")}
                              </p>
                            ) : msg.decryptionFailed ? (
                              <p className="italic opacity-75">
                                {t("chat.messageUnavailable")}
                              </p>
                            ) : (
                              <p dir="auto" className="whitespace-pre-wrap">
                                {segments.map((seg, i) =>
                                  seg.type === "link" ? (
                                    <a
                                      key={i}
                                      href={seg.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        "underline underline-offset-2",
                                        own ? "text-primary-foreground" : "text-primary",
                                      )}
                                    >
                                      {seg.value}
                                    </a>
                                  ) : (
                                    <span key={i}>{seg.value}</span>
                                  ),
                                )}
                              </p>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-muted-foreground">
                            <span>{timeFormatter.format(new Date(msg.createdAt))}</span>
                            {msg.editedAt && !msg.deleted ? (
                              <span>· {t("chat.editedTag")}</span>
                            ) : null}
                            {msg.optimisticState === "sending" ? (
                              <span>· {t("chat.sending")}</span>
                            ) : null}
                            {msg.optimisticState === "failed" ? (
                              <button
                                type="button"
                                onClick={() => void onRetryMessage(msg)}
                                className="inline-flex items-center gap-1 font-semibold text-destructive hover:underline"
                              >
                                <RotateCw className="size-3" />
                                {t("chat.retrySend")}
                              </button>
                            ) : null}
                            {isDm && own && !msg.optimisticState ? (
                              <span
                                data-testid={`msg-receipt-${msg.id}`}
                                className="inline-flex items-center gap-0.5 text-primary"
                              >
                                {isSeenInDm ? (
                                  <>
                                    <CheckCheck className="size-3.5" />
                                    <span>{t("chat.seenReceipt")}</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="size-3.5" />
                                    <span>{t("chat.sentReceipt")}</span>
                                  </>
                                )}
                              </span>
                            ) : null}

                            {!msg.deleted && !msg.decryptionFailed && !msg.optimisticState ? (
                              <div className="inline-flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => setReplyTo(msg)}
                                  aria-label={t("chat.replyAction")}
                                  title={t("chat.replyAction")}
                                  className="rounded p-0.5 hover:text-foreground"
                                >
                                  <Reply className="size-3.5" />
                                </button>
                                {own ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingId(msg.id);
                                        setEditingDraft(msg.body);
                                      }}
                                      aria-label={t("chat.editAction")}
                                      title={t("chat.editAction")}
                                      className="rounded p-0.5 hover:text-foreground"
                                    >
                                      <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDelete(msg)}
                                      aria-label={t("chat.deleteAction")}
                                      title={t("chat.deleteAction")}
                                      className="rounded p-0.5 hover:text-destructive"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {onReportMessage ? (
                                      <button
                                        type="button"
                                        data-testid={`report-msg-${msg.id}`}
                                        onClick={() => onReportMessage(msg)}
                                        aria-label={t("chat.reportBtn")}
                                        title={t("chat.reportBtn")}
                                        className="rounded p-0.5 hover:text-destructive"
                                      >
                                        <Flag className="size-3.5" />
                                      </button>
                                    ) : null}
                                    {conversation?.type === "PUBLIC" &&
                                    onModeratorDeleteMessage ? (
                                      <button
                                        type="button"
                                        data-testid={`mod-delete-msg-${msg.id}`}
                                        onClick={async () => {
                                          const ok = await confirm({
                                            title: t("chat.moderatorDeleteConfirmTitle"),
                                            description: t("chat.moderatorDeleteConfirmDesc"),
                                            variant: "destructive",
                                          });
                                          if (ok) {
                                            await onModeratorDeleteMessage(msg.id);
                                          }
                                        }}
                                        aria-label={t("chat.moderatorDeleteMsg")}
                                        title={t("chat.moderatorDeleteMsg")}
                                        className="rounded p-0.5 hover:text-destructive"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {bottomSpacer > 0 ? (
                <div style={{ height: bottomSpacer }} aria-hidden="true" />
              ) : null}
            </div>
          )}
        </div>

        {!atBottom && messages.length > 0 ? (
          <Button
            type="button"
            size="sm"
            onClick={scrollToBottom}
            className="glass-strong absolute bottom-3 end-4 h-8 rounded-full border border-border/80 px-3 text-xs font-semibold text-foreground shadow-md"
          >
            <ArrowDown className="size-3.5 me-1" />
            {t("chat.jumpToLatest")}
          </Button>
        ) : null}
      </div>

      {typingNames.length > 0 ? (
        <div
          data-testid="chat-typing-indicator"
          className="flex shrink-0 items-center gap-2 border-t border-border/40 bg-card/55 px-4 py-1.5 text-xs text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </span>
          <span>
            {typingNames.length === 1
              ? t("chat.typingSingle").replace("{name}", typingNames[0])
              : t("chat.typingMultiple").replace("{count}", String(typingNames.length))}
          </span>
        </div>
      ) : null}

      <footer className="relative shrink-0 border-t border-border/70 bg-card/85 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:px-4">
        {timeoutActive && publicTimeoutUntil ? (
          <div
            data-testid="chat-timeout-banner"
            className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive"
          >
            {t("chat.timeoutNotice").replace(
              "{date}",
              timeFormatter.format(new Date(publicTimeoutUntil)),
            )}
          </div>
        ) : (
          <>
            {replyTo ? (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-1.5 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">
                    {t("chat.replyingTo").replace(
                      "{name}",
                      replyTo.sender?.name || t("chat.anonymizedAuthor"),
                    )}
                  </p>
                  <p dir="auto" className="truncate text-muted-foreground">
                    {replyTo.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label={t("common.close")}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}

            {emojiOpen ? (
              <div
                data-testid="chat-emoji-picker"
                className="glass-strong absolute bottom-full start-3 mb-2 grid grid-cols-8 gap-1 rounded-2xl border border-border/80 p-2 shadow-layered"
              >
                {CURATED_CHAT_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setDraft((prev) => `${prev}${em}`);
                      textareaRef.current?.focus();
                    }}
                    className="grid size-8 place-items-center rounded-lg text-base hover:bg-primary/15"
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="chat-emoji-btn"
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label={t("chat.emojiPickerLabel")}
                className="size-10 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <Smile className="size-5" />
              </Button>

              <textarea
                ref={textareaRef}
                data-testid="chat-composer-input"
                dir="auto"
                rows={1}
                maxLength={2000}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  onTypingPulse();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitDraft();
                  }
                }}
                placeholder={t("chat.composerPlaceholder")}
                className="min-h-10 max-h-32 flex-1 resize-none rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              <ClickSpark>
                <Button
                  type="button"
                  size="icon"
                  data-testid="chat-send-btn"
                  disabled={draft.trim().length === 0}
                  onClick={() => void submitDraft()}
                  aria-label={t("chat.sendLabel")}
                  className="size-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="size-4" />
                </Button>
              </ClickSpark>
            </div>
          </>
        )}
      </footer>
    </section>
  );
}
