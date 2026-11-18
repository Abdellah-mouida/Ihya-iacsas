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
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ban,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Flag,
  Loader2,
  LogOut,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Reply,
  RotateCw,
  Search,
  Send,
  Smile,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { ClickSpark } from "@/components/common/click-spark";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-provider";
import { parseSafeMessageSegments } from "@/lib/chat/links";
import { cn } from "@/lib/utils";
import {
  type ChatConversationSummary,
  type ChatMessageItem,
  getRoomAccentStyle,
} from "./chat-types";
import styles from "./chat-workspace.module.css";

const ChatEmojiPicker = dynamic(
  () => import("./chat-emoji-picker").then((m) => m.ChatEmojiPicker),
  { ssr: false },
);

const WINDOW_OVERSCAN = 18;
const DEFAULT_ROW_HEIGHT = 64;

function BubbleTail({
  own,
  failed,
  dir,
}: {
  own: boolean;
  failed: boolean;
  dir: "ltr" | "rtl";
}) {
  const flipX = (own && dir === "rtl") || (!own && dir === "ltr");
  return (
    <svg
      viewBox="0 0 8 12"
      width="8"
      height="12"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0",
        own ? "-end-[6px]" : "-start-[6px]",
        own
          ? failed
            ? "text-destructive/15"
            : "text-primary"
          : "text-card",
        flipX ? "-scale-x-100" : "",
      )}
    >
      <path d="M0 0 L8 0 C3.5 2.5 2 6.5 0 11 Z" fill="currentColor" />
    </svg>
  );
}

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
  onLeaveRoom,
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
  onLeaveRoom?: (roomId: string) => Promise<void>;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [nowMs, setNowMs] = useState(0);
  const [scrollWindow, setScrollWindow] = useState({
    start: 0,
    end: 80,
    topSpacer: 0,
    bottomSpacer: 0,
  });
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [openMenuMsgId, setOpenMenuMsgId] = useState<string | null>(null);
  const [longPressedMsgId, setLongPressedMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");
  const [arrivingIds, setArrivingIds] = useState<Set<string>>(() => new Set());

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevLenRef = useRef(0);
  const prevScrollHeightRef = useRef(0);
  const loadingOlderLockRef = useRef(false);
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const initializedConvIdRef = useRef<string | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const copyResetTimerRef = useRef<number | null>(null);
  const focusComposerOnMenuCloseRef = useRef(false);

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

    let acc = 0;
    let approxFirst = 0;
    while (approxFirst < messages.length) {
      const h = heightCacheRef.current.get(messages[approxFirst].id) ?? DEFAULT_ROW_HEIGHT;
      if (acc + h > el.scrollTop) break;
      acc += h;
      approxFirst += 1;
    }
    const visibleCount = Math.max(12, Math.ceil(el.clientHeight / DEFAULT_ROW_HEIGHT));
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
  }, [computeSpacers, hasMore, loadingOlder, messages, onLoadOlder]);

  useEffect(() => {
    if (!loadingOlder) {
      loadingOlderLockRef.current = false;
    }
  }, [loadingOlder]);

  useEffect(() => {
    const convId = conversation?.id ?? null;
    if (!convId) return;
    if (initializedConvIdRef.current !== convId) {
      if (loadingMessages && messages.length === 0) return;
      knownIdsRef.current = new Set(messages.map((m) => m.id));
      initializedConvIdRef.current = convId;
      queueMicrotask(() => setArrivingIds(new Set()));
      return;
    }

    const newIds: string[] = [];
    for (const m of messages) {
      if (!knownIdsRef.current.has(m.id)) {
        knownIdsRef.current.add(m.id);
        newIds.push(m.id);
      }
    }

    if (newIds.length > 0 && newIds.length <= 5 && !loadingOlder && prevScrollHeightRef.current === 0) {
      queueMicrotask(() => {
        setArrivingIds((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.add(id);
          return next;
        });
      });
      const timer = window.setTimeout(() => {
        setArrivingIds((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.delete(id);
          return next;
        });
      }, 220);
      return () => window.clearTimeout(timer);
    }
  }, [conversation, loadingMessages, loadingOlder, messages]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

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
        setSearchOpen(false);
        setSearchQuery("");
        setActiveMatchIdx(0);
        setOpenMenuMsgId(null);
        setLongPressedMsgId(null);
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
      queueMicrotask(() => updateWindowFromScroll());
    } else if (lenDelta > 0 && atBottom) {
      queueMicrotask(() => {
        const start = messages.length <= 60 ? 0 : Math.max(0, messages.length - 50);
        const end = messages.length;
        const { topSpacer, bottomSpacer } = computeSpacers(start, end);
        setScrollWindow({ start, end, topSpacer, bottomSpacer });
        window.requestAnimationFrame(() => {
          const node = listRef.current;
          if (node) {
            node.scrollTop = node.scrollHeight;
          }
        });
      });
    } else if (lenDelta > 0) {
      queueMicrotask(() => updateWindowFromScroll());
    }

    prevLenRef.current = messages.length;
  }, [atBottom, computeSpacers, conversation, messages.length, updateWindowFromScroll]);

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

  const trimmedSearch = searchQuery.trim().toLowerCase();
  const searchActive = searchOpen && trimmedSearch.length > 0;

  const matchedMessageIds = useMemo(() => {
    if (!searchActive) return [] as string[];
    const matches: string[] = [];
    for (const msg of messages) {
      if (msg.deleted || msg.decryptionFailed || msg.type === "SYSTEM") continue;
      if (msg.body.toLowerCase().includes(trimmedSearch)) {
        matches.push(msg.id);
      }
    }
    return matches;
  }, [messages, searchActive, trimmedSearch]);

  const matchedSet = useMemo(() => new Set(matchedMessageIds), [matchedMessageIds]);
  const safeMatchIdx =
    matchedMessageIds.length === 0
      ? 0
      : Math.min(activeMatchIdx, matchedMessageIds.length - 1);
  const activeMatchId = matchedMessageIds[safeMatchIdx] ?? null;

  useEffect(() => {
    if (!activeMatchId) return;
    const container = listRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-testid="chat-message-${CSS.escape(activeMatchId)}"]`,
    );
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatchId]);

  async function copyMessageText(msg: ChatMessageItem) {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(msg.body);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied && typeof document !== "undefined") {
      try {
        const ta = document.createElement("textarea");
        ta.value = msg.body;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      setCopiedMsgId(msg.id);
      setCopyAnnouncement("");
      window.requestAnimationFrame(() => {
        setCopyAnnouncement(t("chat.copiedFeedback"));
      });
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedMsgId(null);
      }, 1200);
    }
  }

  function insertEmojiAtCursor(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setDraft((prev) => `${prev}${emoji}`);
      return;
    }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    window.requestAnimationFrame(() => {
      ta.focus();
      const caret = start + emoji.length;
      try {
        ta.setSelectionRange(caret, caret);
      } catch {
        // Ignore selection errors on unsupported elements
      }
    });
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }

  function openSearchBar() {
    setSearchOpen(true);
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
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

  function renderHighlightedText(text: string) {
    if (!searchActive) return text;
    const lower = text.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let idx = lower.indexOf(trimmedSearch, cursor);
    let key = 0;
    while (idx !== -1) {
      if (idx > cursor) parts.push(text.slice(cursor, idx));
      parts.push(
        <mark
          key={key++}
          className="rounded bg-primary/30 px-0.5 text-inherit underline"
        >
          {text.slice(idx, idx + trimmedSearch.length)}
        </mark>,
      );
      cursor = idx + trimmedSearch.length;
      idx = lower.indexOf(trimmedSearch, cursor);
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts.length > 0 ? parts : text;
  }

  const startIndex =
    searchActive || messages.length <= 60 ? 0 : Math.max(0, scrollWindow.start);
  const endIndex =
    searchActive || messages.length <= 60
      ? messages.length
      : Math.min(messages.length, scrollWindow.end);
  const visibleMessages = messages.slice(startIndex, endIndex);

  const topSpacer = searchActive || messages.length <= 60 ? 0 : scrollWindow.topSpacer;
  const bottomSpacer =
    searchActive || messages.length <= 60 ? 0 : scrollWindow.bottomSpacer;

  const accent = getRoomAccentStyle(conversation.accentColor);
  const latestReportableMessage = [...messages]
    .reverse()
    .find((m) => m.senderId !== currentUserId && !m.deleted && !m.decryptionFailed && m.type !== "SYSTEM");

  const typingText =
    typingNames.length === 1
      ? t("chat.typingSingle").replace("{name}", typingNames[0])
      : typingNames.length > 1
        ? t("chat.typingMultiple").replace("{count}", String(typingNames.length))
        : null;

  return (
    <section
      data-testid="chat-conversation-pane"
      className="flex h-full min-h-0 flex-col bg-transparent"
    >
      {ConfirmDialogComponent}
      <div className="sr-only" aria-live="polite" data-testid="chat-copy-live">
        {copyAnnouncement}
      </div>

      <header
        data-testid="chat-conv-header"
        className="flex shrink-0 items-center justify-between gap-1 border-b border-border/70 bg-card/75 px-1.5 py-1.5 sm:gap-2 sm:px-4 sm:py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
          {showMobileBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="chat-mobile-back-btn"
              onClick={onMobileBack}
              aria-label={t("chat.backToList")}
              className="size-11 shrink-0 rounded-xl md:hidden"
            >
              <BackIcon className="size-5" />
            </Button>
          ) : null}

          {isDm && conversation.peer ? (
            <Link
              href={`/u/${conversation.peer.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 py-0.5 hover:opacity-85 sm:gap-2.5"
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
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-bold text-foreground sm:text-base">
                  {title}
                </p>
                {typingText ? (
                  <p
                    data-testid="chat-typing-indicator"
                    className="truncate text-xs font-medium text-primary"
                  >
                    {typingText}
                  </p>
                ) : (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {peerOnline ? t("friends.online") : t("friends.offline")}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 py-0.5 sm:gap-2.5">
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl border text-base",
                  isRoom ? accent.badge : "border-primary/25 bg-primary/10",
                )}
              >
                {conversation.emoji || "🌙"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-bold text-foreground sm:text-base">
                  {title}
                </p>
                {typingText ? (
                  <p
                    data-testid="chat-typing-indicator"
                    className="truncate text-xs font-medium text-primary"
                  >
                    {typingText}
                  </p>
                ) : (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {isPublic
                      ? t("chat.publicSpaceDesc")
                      : t("chat.membersCount").replace(
                          "{count}",
                          String(conversation.memberCount),
                        )}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="chat-conv-search-btn"
            onClick={() => (searchOpen ? setSearchOpen(false) : openSearchBar())}
            aria-label={t("chat.searchInConv")}
            title={t("chat.searchInConv")}
            className="size-11 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Search className="size-4" />
          </Button>

          {isRoom ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="chat-room-members-btn"
              onClick={onOpenRoomPanel}
              className="hidden h-11 rounded-xl px-3 text-xs font-semibold md:inline-flex"
            >
              <Users className="size-4 me-1.5" />
              <span>{t("chat.membersBtn")}</span>
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="chat-conv-menu-btn"
                aria-label={t("chat.convMenuLabel")}
                title={t("chat.convMenuLabel")}
                className="size-11 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                data-testid="chat-menu-search"
                onClick={openSearchBar}
                className="min-h-11 gap-2"
              >
                <Search className="size-4" />
                <span>{t("chat.searchInConv")}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                data-testid="chat-mute-toggle-btn"
                onClick={() => void onToggleMute(conversation.id, !conversation.muted)}
                className="min-h-11 gap-2"
              >
                {conversation.muted ? (
                  <>
                    <Bell className="size-4" />
                    <span>{t("chat.unmuteRoom")}</span>
                  </>
                ) : (
                  <>
                    <BellOff className="size-4" />
                    <span>{t("chat.muteRoom")}</span>
                  </>
                )}
              </DropdownMenuItem>

              {isRoom ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="chat-menu-members"
                    onClick={onOpenRoomPanel}
                    className="min-h-11 gap-2"
                  >
                    <Users className="size-4" />
                    <span>{t("chat.membersBtn")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="chat-menu-invite"
                    onClick={onOpenRoomPanel}
                    className="min-h-11 gap-2"
                  >
                    <UserPlus className="size-4" />
                    <span>{t("chat.inviteFriendsMenu")}</span>
                  </DropdownMenuItem>
                  {onLeaveRoom ? (
                    <DropdownMenuItem
                      data-testid="chat-menu-leave"
                      variant="destructive"
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("chat.leaveRoomTitle"),
                          description: t("chat.leaveRoomDesc"),
                          variant: "destructive",
                        });
                        if (ok) {
                          await onLeaveRoom(conversation.id);
                        }
                      }}
                      className="min-h-11 gap-2"
                    >
                      <LogOut className="size-4" />
                      <span>{t("chat.leaveRoomBtn")}</span>
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}

              {isDm && conversation.peer ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11 gap-2">
                    <Link href={`/u/${conversation.peer.id}`}>
                      <ExternalLink className="size-4" />
                      <span>{t("chat.viewProfile")}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="chat-menu-unfriend"
                    variant="destructive"
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
                    className="min-h-11 gap-2"
                  >
                    <UserMinus className="size-4" />
                    <span>{t("friends.unfriend")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    data-testid="chat-menu-block"
                    variant="destructive"
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
                    className="min-h-11 gap-2"
                  >
                    <Ban className="size-4" />
                    <span>{t("friends.blockUser")}</span>
                  </DropdownMenuItem>
                </>
              ) : null}

              {latestReportableMessage && onReportMessage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="chat-menu-report"
                    onClick={() => onReportMessage(latestReportableMessage)}
                    className="min-h-11 gap-2"
                  >
                    <Flag className="size-4" />
                    <span>{t("chat.reportBtn")}</span>
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {searchOpen ? (
        <div
          data-testid="chat-conv-search-bar"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-card/65 px-3 py-2 sm:px-4"
        >
          <div className="relative min-w-44 flex-1">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-testid="chat-conv-search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMatchIdx(0);
              }}
              placeholder={t("chat.searchInConvPlaceholder")}
              className="h-11 rounded-xl ps-9 pe-3 text-base placeholder:text-base md:text-sm md:placeholder:text-sm"
            />
          </div>

          {searchActive ? (
            <div className="flex items-center gap-1">
              <span className="px-1.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                {matchedMessageIds.length === 0
                  ? t("chat.searchNoMatches")
                  : `${safeMatchIdx + 1}/${matchedMessageIds.length}`}
              </span>
              {matchedMessageIds.length > 1 ? (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t("chat.searchPrev")}
                    onClick={() =>
                      setActiveMatchIdx((idx) =>
                        idx <= 0 ? matchedMessageIds.length - 1 : idx - 1,
                      )
                    }
                    className="size-11 rounded-xl"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={t("chat.searchNext")}
                    onClick={() =>
                      setActiveMatchIdx((idx) =>
                        idx >= matchedMessageIds.length - 1 ? 0 : idx + 1,
                      )
                    }
                    className="size-11 rounded-xl"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {hasMore ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="chat-search-load-older"
              disabled={loadingOlder}
              onClick={onLoadOlder}
              className="h-11 rounded-xl px-3 text-xs font-semibold"
            >
              {loadingOlder ? t("chat.loadingMessages") : t("chat.loadOlder")}
            </Button>
          ) : null}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("common.close")}
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="size-11 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={updateWindowFromScroll}
          data-testid="chat-messages-scroll"
          className={cn(styles.chatScroll, "h-full overflow-y-auto px-2 py-2 sm:px-4 sm:py-3")}
        >
          {hasMore && !loadingOlder ? (
            <div className="pb-3 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="chat-load-older-btn"
                onClick={onLoadOlder}
                className="h-11 rounded-xl px-4 text-xs font-semibold"
              >
                {t("chat.loadOlder")}
              </Button>
            </div>
          ) : null}
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
            <div className="flex flex-col">
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
                    5 * 60_000;

                const msgTime = new Date(msg.createdAt).getTime();
                const receiptMembers =
                  conversation.type === "PUBLIC"
                    ? []
                    : conversation.memberStates && conversation.memberStates.length > 0
                      ? conversation.memberStates.filter(
                          (m) => m.userId !== currentUserId,
                        )
                      : conversation.peer
                        ? [
                            {
                              userId: conversation.peer.id,
                              lastReadAt: conversation.peer.lastReadAt,
                              lastDeliveredAt:
                                conversation.peer.lastDeliveredAt ?? null,
                            },
                          ]
                        : [];
                const showReceipt =
                  conversation.type !== "PUBLIC" &&
                  own &&
                  !msg.optimisticState &&
                  receiptMembers.length > 0;
                const isSeen =
                  showReceipt &&
                  receiptMembers.every(
                    (m) =>
                      Boolean(m.lastReadAt) &&
                      new Date(m.lastReadAt!).getTime() >= msgTime,
                  );
                const isDelivered =
                  showReceipt &&
                  (isSeen ||
                    receiptMembers.every(
                      (m) =>
                        Boolean(m.lastDeliveredAt) &&
                        new Date(m.lastDeliveredAt!).getTime() >= msgTime,
                    ));
                const deliveryState: "seen" | "delivered" | "sent" = isSeen
                  ? "seen"
                  : isDelivered
                    ? "delivered"
                    : "sent";

                const senderName = msg.isAnonymized
                  ? t("chat.anonymizedAuthor")
                  : msg.sender?.name || t("chatInvite.unknownInviter");

                const segments = parseSafeMessageSegments(msg.body);
                const isArriving = arrivingIds.has(msg.id);
                const hasMenu =
                  !msg.deleted && !msg.decryptionFailed && !msg.optimisticState;
                const menuSide = (own ? dir === "ltr" : dir === "rtl") ? "left" : "right";

                const actionTriggerEl = hasMenu ? (
                  <DropdownMenu
                    open={openMenuMsgId === msg.id}
                    onOpenChange={(open) => {
                      setOpenMenuMsgId(open ? msg.id : null);
                      if (!open) {
                        setLongPressedMsgId((cur) => (cur === msg.id ? null : cur));
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        data-testid={`msg-actions-trigger-${msg.id}`}
                        aria-label={t("chat.messageActionsLabel")}
                        className={cn(
                          "shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity hover:bg-muted/60 hover:text-foreground focus-visible:opacity-100",
                          longPressedMsgId === msg.id || openMenuMsgId === msg.id
                            ? "inline-flex size-11 md:size-7 opacity-100"
                            : "hidden md:inline-flex md:size-7 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                        )}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side={menuSide}
                      align="center"
                      sideOffset={6}
                      collisionPadding={12}
                      avoidCollisions
                      onCloseAutoFocus={(e) => {
                        if (focusComposerOnMenuCloseRef.current) {
                          e.preventDefault();
                          focusComposerOnMenuCloseRef.current = false;
                          textareaRef.current?.focus();
                        }
                      }}
                      className="w-44"
                    >
                      <DropdownMenuItem
                        data-testid={`copy-msg-${msg.id}`}
                        onClick={() => void copyMessageText(msg)}
                        className="min-h-11 gap-2 md:min-h-9"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="size-4 text-primary" />
                            <span>{t("chat.copiedFeedback")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-4" />
                            <span>{t("chat.copyAction")}</span>
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid={`reply-msg-${msg.id}`}
                        onClick={() => {
                          focusComposerOnMenuCloseRef.current = true;
                          setReplyTo(msg);
                          textareaRef.current?.focus();
                        }}
                        className="min-h-11 gap-2 md:min-h-9"
                      >
                        <Reply className="size-4" />
                        <span>{t("chat.replyAction")}</span>
                      </DropdownMenuItem>
                      {own ? (
                        <>
                          <DropdownMenuItem
                            data-testid={`edit-msg-${msg.id}`}
                            onClick={() => {
                              setEditingId(msg.id);
                              setEditingDraft(msg.body);
                            }}
                            className="min-h-11 gap-2 md:min-h-9"
                          >
                            <Pencil className="size-4" />
                            <span>{t("chat.editAction")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            data-testid={`delete-msg-${msg.id}`}
                            variant="destructive"
                            onClick={() => void handleDelete(msg)}
                            className="min-h-11 gap-2 md:min-h-9"
                          >
                            <Trash2 className="size-4" />
                            <span>{t("chat.deleteAction")}</span>
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          {onReportMessage ? (
                            <DropdownMenuItem
                              data-testid={`report-msg-${msg.id}`}
                              onClick={() => onReportMessage(msg)}
                              className="min-h-11 gap-2 md:min-h-9"
                            >
                              <Flag className="size-4" />
                              <span>{t("chat.reportBtn")}</span>
                            </DropdownMenuItem>
                          ) : null}
                          {conversation?.type === "PUBLIC" &&
                          onModeratorDeleteMessage ? (
                            <DropdownMenuItem
                              data-testid={`mod-delete-msg-${msg.id}`}
                              variant="destructive"
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
                              className="min-h-11 gap-2 md:min-h-9"
                            >
                              <Trash2 className="size-4" />
                              <span>{t("chat.moderatorDeleteMsg")}</span>
                            </DropdownMenuItem>
                          ) : null}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null;

                return (
                  <div
                    key={msg.id}
                    className={styles.messageRow}
                    ref={(node) => {
                      if (node) {
                        const h = node.getBoundingClientRect().height;
                        if (h > 0) heightCacheRef.current.set(msg.id, h);
                      }
                    }}
                  >
                    {showDay ? (
                      <div className="my-2.5 flex items-center justify-center">
                        <span className="rounded-full border border-border/70 bg-card/85 px-3 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {dateFormatter.format(new Date(msg.createdAt))}
                        </span>
                      </div>
                    ) : null}

                    {msg.type === "SYSTEM" ? (
                      <div className="my-1.5 text-center text-xs text-muted-foreground">
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
                        <div className="rounded-2xl border border-primary/30 bg-card/95 max-w-xs p-3.5 shadow-sm sm:max-w-sm">
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
                                  className="h-11 rounded-xl bg-primary px-4 text-xs text-primary-foreground"
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
                                  className="h-11 rounded-xl px-4 text-xs"
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
                        data-group-first={!sameGroup ? "true" : "false"}
                        className={cn(
                          "group flex items-start",
                          !isDm ? "gap-2" : "",
                          own ? "justify-end pe-2" : isDm ? "justify-start ps-2" : "justify-start",
                          absIndex === 0 || showDay ? "mt-0" : sameGroup ? "mt-[2px]" : "mt-2",
                          isArriving
                            ? cn(
                                styles.messageArrival,
                                own ? styles.messageArrivalOwn : styles.messageArrivalOther,
                              )
                            : "",
                        )}
                      >
                        {!own && !isDm ? (
                          <div className="w-8 shrink-0 pt-0.5">
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
                            "flex min-w-0 flex-col",
                            isDm || own
                              ? "max-w-[90%] md:max-w-[60%]"
                              : "max-w-[min(90%,calc(100%-2.75rem))] md:max-w-[60%]",
                            own ? "items-end" : "items-start",
                          )}
                        >
                          {!own && !isDm && !sameGroup ? (
                            msg.sender && !msg.isAnonymized ? (
                              <Link
                                href={`/u/${msg.sender.id}`}
                                className="mb-0.5 px-1 text-xs font-semibold text-primary hover:underline"
                              >
                                {senderName}
                              </Link>
                            ) : (
                              <span className="mb-0.5 px-1 text-xs font-semibold text-muted-foreground">
                                {senderName}
                              </span>
                            )
                          ) : null}

                          <div
                            className={cn(
                              "flex max-w-full items-center gap-1",
                              own ? "flex-row" : "flex-row",
                            )}
                          >
                            {own ? (
                              <>
                                {copiedMsgId === msg.id ? (
                                  <span
                                    data-testid={`msg-copied-badge-${msg.id}`}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card/95 px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm animate-in fade-in zoom-in-95 duration-150"
                                  >
                                    <Check className="size-3" />
                                    <span>{t("chat.copiedFeedback")}</span>
                                  </span>
                                ) : null}
                                {actionTriggerEl}
                              </>
                            ) : null}

                            <div
                              data-testid={`msg-bubble-${msg.id}`}
                              data-tail={!sameGroup ? "true" : "false"}
                              onPointerDown={(e) => {
                                if (!hasMenu || e.pointerType === "mouse") return;
                                clearLongPressTimer();
                                longPressOriginRef.current = { x: e.clientX, y: e.clientY };
                                longPressTimerRef.current = window.setTimeout(() => {
                                  setLongPressedMsgId(msg.id);
                                  setOpenMenuMsgId(msg.id);
                                  longPressTimerRef.current = null;
                                }, 420);
                              }}
                              onPointerMove={(e) => {
                                const origin = longPressOriginRef.current;
                                if (!origin) return;
                                if (
                                  Math.abs(e.clientX - origin.x) > 8 ||
                                  Math.abs(e.clientY - origin.y) > 8
                                ) {
                                  clearLongPressTimer();
                                }
                              }}
                              onPointerUp={clearLongPressTimer}
                              onPointerCancel={clearLongPressTimer}
                              className={cn(
                                "relative min-w-0 rounded-2xl border px-3 py-1.5 text-sm leading-relaxed [overflow-wrap:anywhere]",
                                !sameGroup
                                  ? own
                                    ? "rounded-se-[4px]"
                                    : "rounded-ss-[4px]"
                                  : "",
                                own
                                  ? "border-primary/25 bg-primary text-primary-foreground"
                                  : "border-border/75 bg-card text-foreground",
                                matchedSet.has(msg.id)
                                  ? msg.id === activeMatchId
                                    ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                    : "ring-1 ring-primary/50"
                                  : "",
                                msg.optimisticState === "sending" ? "opacity-80" : "",
                                msg.optimisticState === "failed"
                                  ? "border-destructive bg-destructive/15 text-foreground"
                                  : "",
                              )}
                            >
                              {!sameGroup ? (
                                <BubbleTail
                                  own={own}
                                  failed={msg.optimisticState === "failed"}
                                  dir={dir}
                                />
                              ) : null}

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
                                <div className="min-w-48 space-y-2">
                                  <textarea
                                    dir="auto"
                                    value={editingDraft}
                                    onChange={(e) => setEditingDraft(e.target.value)}
                                    maxLength={2000}
                                    rows={2}
                                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring md:text-sm"
                                  />
                                  <div className="flex justify-end gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingId(null)}
                                      className="h-11 px-3 text-xs text-foreground"
                                    >
                                      {t("chat.cancelEdit")}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => void handleSaveEdit(msg.id)}
                                      className="h-11 bg-primary px-3 text-xs text-primary-foreground"
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
                                <p dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                                  {segments.map((seg, i) =>
                                    seg.type === "link" ? (
                                      <a
                                        key={i}
                                        href={seg.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                          "underline underline-offset-2 [overflow-wrap:anywhere]",
                                          own ? "text-primary-foreground" : "text-primary",
                                        )}
                                      >
                                        {renderHighlightedText(seg.value)}
                                      </a>
                                    ) : (
                                      <span key={i}>{renderHighlightedText(seg.value)}</span>
                                    ),
                                  )}
                                </p>
                              )}

                              <div
                                data-testid={`msg-bubble-meta-${msg.id}`}
                                className={cn(
                                  "mt-0.5 flex items-center justify-end gap-1 text-[10px] leading-none",
                                  own && msg.optimisticState !== "failed"
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground",
                                )}
                              >
                                {msg.editedAt && !msg.deleted ? (
                                  <span>{t("chat.editedTag")}</span>
                                ) : null}
                                <span dir="ltr">{timeFormatter.format(new Date(msg.createdAt))}</span>
                                {conversation.type !== "PUBLIC" &&
                                own &&
                                msg.optimisticState === "sending" ? (
                                  <span
                                    data-testid={`msg-receipt-${msg.id}`}
                                    data-delivery-state="sending"
                                    className="inline-flex items-center"
                                  >
                                    <Loader2
                                      className="size-3 animate-spin text-primary-foreground/80"
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">{t("chat.sending")}</span>
                                  </span>
                                ) : conversation.type !== "PUBLIC" &&
                                  own &&
                                  msg.optimisticState === "failed" ? (
                                  <button
                                    type="button"
                                    data-testid={`msg-retry-${msg.id}`}
                                    onClick={() => void onRetryMessage(msg)}
                                    aria-label={t("chat.retrySend")}
                                    title={t("chat.retrySend")}
                                    className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-destructive hover:underline"
                                  >
                                    <AlertCircle className="size-3.5" aria-hidden="true" />
                                    <RotateCw className="size-3" aria-hidden="true" />
                                  </button>
                                ) : showReceipt ? (
                                  <span
                                    data-testid={`msg-receipt-${msg.id}`}
                                    data-delivery-state={deliveryState}
                                    className="inline-flex items-center"
                                  >
                                    {deliveryState === "seen" ? (
                                      <CheckCheck
                                        style={{ color: "var(--chat-seen)" }}
                                        className="size-3.5 drop-shadow-[0_0_2px_color-mix(in_oklch,var(--chat-seen)_35%,transparent)]"
                                        strokeWidth={2.5}
                                        aria-hidden="true"
                                      />
                                    ) : deliveryState === "delivered" ? (
                                      <CheckCheck
                                        className="size-3.5 text-primary-foreground/70"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Check
                                        className="size-3.5 text-primary-foreground/70"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="sr-only">
                                      {deliveryState === "seen"
                                        ? t("chat.seenReceipt")
                                        : deliveryState === "delivered"
                                          ? t("chat.deliveredReceipt")
                                          : t("chat.sentReceipt")}
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {!own ? (
                              <>
                                {actionTriggerEl}
                                {copiedMsgId === msg.id ? (
                                  <span
                                    data-testid={`msg-copied-badge-${msg.id}`}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-card/95 px-2 py-0.5 text-[11px] font-medium text-primary shadow-sm animate-in fade-in zoom-in-95 duration-150"
                                  >
                                    <Check className="size-3" />
                                    <span>{t("chat.copiedFeedback")}</span>
                                  </span>
                                ) : null}
                              </>
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
            data-testid="chat-jump-to-latest"
            onClick={scrollToBottom}
            className="absolute bottom-3 end-3 h-11 rounded-full border border-border/80 bg-card/95 px-4 text-xs font-semibold text-foreground shadow-md hover:bg-card"
          >
            <ArrowDown className="size-4 me-1.5" />
            {t("chat.jumpToLatest")}
          </Button>
        ) : null}
      </div>

      <footer
        data-testid="chat-composer-footer"
        className="relative shrink-0 border-t border-border/70 bg-card/85 px-2.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-2.5"
      >
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
                  data-testid="chat-reply-cancel-btn"
                  onClick={() => setReplyTo(null)}
                  aria-label={t("common.close")}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="chat-emoji-btn"
                aria-expanded={emojiOpen}
                onClick={() => setEmojiOpen((v) => !v)}
                aria-label={t("chat.emojiPickerLabel")}
                className={cn(
                  "size-11 shrink-0 rounded-xl hover:text-foreground",
                  emojiOpen ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
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
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submitDraft();
                  }
                }}
                placeholder={t("chat.composerPlaceholder")}
                className="min-h-11 max-h-32 flex-1 resize-none rounded-2xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-base text-foreground placeholder:text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:text-sm md:placeholder:text-sm"
              />

              <ClickSpark>
                <Button
                  type="button"
                  size="icon"
                  data-testid="chat-send-btn"
                  disabled={draft.trim().length === 0}
                  onClick={() => void submitDraft()}
                  aria-label={t("chat.sendLabel")}
                  className="size-11 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Send className="size-4" />
                </Button>
              </ClickSpark>
            </div>

            {emojiOpen ? (
              <ChatEmojiPicker
                onSelect={insertEmojiAtCursor}
                onClose={() => setEmojiOpen(false)}
              />
            ) : null}
          </>
        )}
      </footer>
    </section>
  );
}
