"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Lock,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  Users,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatedList } from "@/components/common/animated-list";
import { SpotlightCard } from "@/components/common/spotlight-card";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import rbStyles from "@/components/common/react-bits-adaptations.module.css";
import {
  type ChatConversationSummary,
  type ChatTab,
  type ChatUserSummary,
  type FriendsDashboardState,
  getRoomAccentStyle,
} from "./chat-types";
import styles from "./chat-workspace.module.css";

function UnreadPill({ count, testId }: { count: number; testId?: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={testId}
      className={cn(
        styles.unreadBadgePop,
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-none text-primary-foreground",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function formatListTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const isSameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isSameDay) {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

export function ChatSidebar({
  currentUserId,
  activeTab,
  onTabChange,
  conversations,
  selectedConversationId,
  onSelectConversation,
  friendsData,
  onlineUsers,
  onOpenDm,
  onFriendAction,
  onOpenCreateRoom,
}: {
  currentUserId: string;
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  conversations: ChatConversationSummary[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  friendsData: FriendsDashboardState;
  onlineUsers: Set<string>;
  onOpenDm: (friendId: string) => void;
  onFriendAction: (
    action: "send" | "cancel" | "accept" | "decline" | "unfriend" | "block" | "unblock",
    targetUserId: string,
  ) => Promise<void>;
  onOpenCreateRoom: () => void;
}) {
  const { locale, t } = useLocale();
  const [search, setSearch] = useState("");
  const [userResults, setUserResults] = useState<ChatUserSummary[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);

  const trimmedSearch = search.trim();

  useEffect(() => {
    if (trimmedSearch.length < 3) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(
          `/api/chat/users/search?q=${encodeURIComponent(trimmedSearch)}`,
          { cache: "no-store" },
        );
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { users?: ChatUserSummary[] };
          setUserResults(data.users ?? []);
        }
      } finally {
        if (!cancelled) setSearchingUsers(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedSearch]);

  const displayedUserResults = trimmedSearch.length >= 3 ? userResults : [];

  const dmConvs = useMemo(
    () => conversations.filter((c) => c.type === "DM"),
    [conversations],
  );
  const roomConvs = useMemo(
    () => conversations.filter((c) => c.type === "ROOM"),
    [conversations],
  );

  const dmByPeerId = useMemo(() => {
    const map = new Map<string, ChatConversationSummary>();
    for (const dm of dmConvs) {
      if (dm.peer?.id) map.set(dm.peer.id, dm);
    }
    return map;
  }, [dmConvs]);

  const friendsUnread =
    dmConvs.reduce((acc, c) => acc + (c.muted ? 0 : c.unreadCount), 0) +
    friendsData.incomingRequests.length;
  const roomsUnread = roomConvs.reduce(
    (acc, c) => acc + (c.muted ? 0 : c.unreadCount),
    0,
  );

  const lower = trimmedSearch.toLowerCase();

  const friendEntries = useMemo(() => {
    const entries = friendsData.friends.map((friend) => ({
      friend,
      dm: dmByPeerId.get(friend.id) ?? null,
    }));
    const filtered = lower
      ? entries.filter(({ friend }) =>
          (friend.name || "").toLowerCase().includes(lower),
        )
      : entries;

    filtered.sort((a, b) => {
      const ta = a.dm?.lastMessageAt ? new Date(a.dm.lastMessageAt).getTime() : 0;
      const tb = b.dm?.lastMessageAt ? new Date(b.dm.lastMessageAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (a.friend.name || "").localeCompare(b.friend.name || "");
    });
    return filtered;
  }, [dmByPeerId, friendsData.friends, lower]);

  const filteredRooms = useMemo(() => {
    const base = lower
      ? roomConvs.filter((r) => (r.name || "").toLowerCase().includes(lower))
      : roomConvs;
    return [...base].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
  }, [lower, roomConvs]);

  const friendIds = new Set(friendsData.friends.map((f) => f.id));
  const incomingIds = new Set(friendsData.incomingRequests.map((r) => r.user.id));
  const outgoingIds = new Set(friendsData.outgoingRequests.map((r) => r.user.id));
  const totalRequestsCount =
    friendsData.incomingRequests.length + friendsData.outgoingRequests.length;

  function renderLastMessagePreview(conv: ChatConversationSummary | null): string {
    if (!conv?.lastMessage) return t("chat.tapToChat");
    if (conv.lastMessage.deleted) return t("chat.deletedMessage");
    if (conv.lastMessage.decryptionFailed) return t("chat.messageUnavailable");
    if (conv.lastMessage.type === "ROOM_INVITE") return t("chatInvite.badge");
    const prefix =
      conv.type === "DM"
        ? conv.lastMessage.senderId === currentUserId
          ? t("chat.youPrefix")
          : ""
        : conv.lastMessage.senderName
          ? `${conv.lastMessage.senderName}: `
          : "";
    return `${prefix}${conv.lastMessage.body}`;
  }

  return (
    <aside
      data-testid="chat-sidebar"
      className="flex h-full flex-col border-e border-border/70 bg-card/70"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <h1
            data-rb="ShinyText"
            className={cn(
              rbStyles.shinyText,
              "truncate font-heading text-lg font-bold text-foreground",
            )}
          >
            {t("chat.messagesPageTitle")}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {t("chat.messagesPageSubtitle")}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          data-testid="chat-new-room-btn"
          onClick={onOpenCreateRoom}
          className="h-11 min-w-11 shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4 sm:me-1" />
          <span className="hidden sm:inline">{t("chat.newRoom")}</span>
        </Button>
      </div>

      <div className="border-b border-border/60 px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="chat-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            className="h-11 rounded-xl ps-10 pe-11 text-base placeholder:text-base md:text-sm md:placeholder:text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("common.close")}
              className="absolute top-1/2 end-0 grid size-11 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {trimmedSearch.length > 0 && trimmedSearch.length < 3 ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t("chat.searchHint")}
          </p>
        ) : null}

        {trimmedSearch.length >= 3 ? (
          <div
            data-testid="chat-user-search-results"
            className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-2xl border border-border/70 bg-background/70 p-2"
          >
            <p className="px-1 text-[11px] font-semibold text-muted-foreground">
              {t("chat.searchUsersHeading")}
            </p>
            {searchingUsers ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {t("common.loading")}
              </p>
            ) : displayedUserResults.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {t("chat.searchNoUsers")}
              </p>
            ) : (
              displayedUserResults.map((user) => {
                const isFriend = friendIds.has(user.id);
                const isIncoming = incomingIds.has(user.id);
                const isOutgoing = outgoingIds.has(user.id);
                return (
                  <SpotlightCard
                    key={user.id}
                    className="rounded-xl border border-border/60 bg-card/70 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/u/${user.id}`}
                        className="flex min-w-0 items-center gap-2 hover:opacity-85"
                      >
                        <UserAvatar user={user} size="sm" shape="circle" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {user.name || t("chatInvite.unknownInviter")}
                          </p>
                          {user.city ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {user.city}
                            </p>
                          ) : null}
                        </div>
                      </Link>

                      {isFriend ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenDm(user.id)}
                          className="h-11 rounded-xl px-3 text-xs"
                        >
                          {t("chat.openDm")}
                        </Button>
                      ) : isIncoming ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onFriendAction("accept", user.id)}
                          className="h-11 rounded-xl bg-primary px-3 text-xs text-primary-foreground"
                        >
                          {t("friends.acceptRequest")}
                        </Button>
                      ) : isOutgoing ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onFriendAction("cancel", user.id)}
                          className="h-11 rounded-xl px-3 text-xs"
                        >
                          {t("friends.requestSent")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onFriendAction("send", user.id)}
                          className="h-11 rounded-xl px-3 text-xs"
                        >
                          <UserPlus className="size-3.5 me-1" />
                          {t("friends.addFriend")}
                        </Button>
                      )}
                    </div>
                  </SpotlightCard>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div
        role="tablist"
        className="grid grid-cols-2 gap-1 border-b border-border/60 bg-muted/25 p-1.5"
      >
        {(
          [
            { id: "friends", label: t("chat.tabFriends"), count: friendsUnread, Icon: Users },
            { id: "rooms", label: t("chat.tabRooms"), count: roomsUnread, Icon: Lock },
          ] as const
        ).map(({ id, label, count, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`chat-tab-${id}`}
              onClick={() => onTabChange(id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                active
                  ? "border border-border/70 bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="truncate">{label}</span>
              <UnreadPill count={count} />
            </button>
          );
        })}
      </div>

      <div className={cn(styles.chatScroll, "min-h-0 flex-1 overflow-y-auto p-3 space-y-3")}>
        {activeTab === "friends" ? (
          <div className="space-y-3">
            {totalRequestsCount > 0 ? (
              <section className="space-y-2">
                <button
                  type="button"
                  data-testid="friends-requests-pinned-row"
                  aria-expanded={requestsOpen}
                  onClick={() => setRequestsOpen((o) => !o)}
                  className="flex min-h-12 w-full items-center justify-between gap-2.5 rounded-2xl border border-primary/25 bg-primary/10 px-3.5 py-2.5 text-start transition-colors hover:bg-primary/15"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                      <UserPlus className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">
                        {t("chat.requestsInbox")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("chat.requestsCount").replace(
                          "{count}",
                          String(totalRequestsCount),
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <UnreadPill count={friendsData.incomingRequests.length} />
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        requestsOpen && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {requestsOpen ? (
                  <div className="space-y-2 ps-1" data-testid="chat-requests-inbox">
                    {friendsData.incomingRequests.map((req) => (
                      <SpotlightCard
                        key={req.friendshipId}
                        className="rounded-2xl border border-primary/25 bg-card/85 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/u/${req.user.id}`}
                            className="flex min-w-0 items-center gap-2.5"
                          >
                            <UserAvatar user={req.user} size="sm" shape="circle" />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">
                                {req.user.name || t("chatInvite.unknownInviter")}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {t("chat.incomingRequests").replace("{count}", "1")}
                              </p>
                            </div>
                          </Link>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              data-testid={`accept-friend-${req.user.id}`}
                              onClick={() => void onFriendAction("accept", req.user.id)}
                              aria-label={t("friends.acceptRequest")}
                              className="size-11 rounded-xl bg-primary text-primary-foreground"
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              data-testid={`decline-friend-${req.user.id}`}
                              onClick={() => void onFriendAction("decline", req.user.id)}
                              aria-label={t("friends.declineRequest")}
                              className="size-11 rounded-xl"
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </SpotlightCard>
                    ))}

                    {friendsData.outgoingRequests.map((req) => (
                      <div
                        key={req.friendshipId}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/50 px-3 py-2.5"
                      >
                        <Link
                          href={`/u/${req.user.id}`}
                          className="flex min-w-0 items-center gap-2.5"
                        >
                          <UserAvatar user={req.user} size="sm" shape="circle" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {req.user.name || t("chatInvite.unknownInviter")}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {t("friends.requestSent")}
                            </p>
                          </div>
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => void onFriendAction("cancel", req.user.id)}
                          className="h-11 rounded-xl px-3 text-xs text-muted-foreground"
                        >
                          {t("friends.cancelRequest")}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {friendEntries.length === 0 ? (
              <div
                data-testid="friends-empty-state"
                className="rounded-2xl border border-border/60 bg-background/40 p-5 text-center space-y-1.5"
              >
                <p className="text-sm font-semibold text-foreground">
                  {t("chat.friendsEmptyTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("chat.friendsEmptyDesc")}
                </p>
              </div>
            ) : (
              <AnimatedList
                testId="chat-friends-list"
                items={friendEntries.map((entry) => ({
                  key: entry.friend.id,
                  ...entry,
                }))}
                renderItem={({ friend, dm }) => {
                  const isOnline =
                    friend.isOnline === null
                      ? false
                      : Boolean(friend.isOnline || onlineUsers.has(friend.id));
                  const active = Boolean(dm && selectedConversationId === dm.id);
                  const preview = renderLastMessagePreview(dm);
                  const timeText = formatListTime(dm?.lastMessageAt, locale);

                  return (
                    <button
                      type="button"
                      data-testid={`open-dm-${friend.id}`}
                      onClick={() =>
                        dm ? onSelectConversation(dm.id) : onOpenDm(friend.id)
                      }
                      className={cn(
                        "flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition-colors",
                        active
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/65 bg-background/45 hover:bg-muted/40",
                      )}
                    >
                      <div className="relative shrink-0">
                        <UserAvatar user={friend} size="md" shape="circle" />
                        {isOnline ? (
                          <span
                            data-online="true"
                            className="absolute bottom-0 end-0 size-3 rounded-full border-2 border-card bg-green"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-foreground">
                            {friend.name || t("chatInvite.unknownInviter")}
                          </p>
                          {timeText ? (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {timeText}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {preview}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {dm?.muted ? (
                              <VolumeX className="size-3.5 text-muted-foreground" />
                            ) : null}
                            <UnreadPill count={dm?.muted ? 0 : dm?.unreadCount ?? 0} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                }}
              />
            )}

            {friendsData.blockedUsers.length > 0 ? (
              <section className="space-y-1.5 pt-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("chat.blockedHeading").replace(
                    "{count}",
                    String(friendsData.blockedUsers.length),
                  )}
                </p>
                {friendsData.blockedUsers.map((blocked) => (
                  <div
                    key={blocked.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-muted-foreground">
                      {blocked.name || blocked.id}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void onFriendAction("unblock", blocked.id)}
                      className="h-11 px-3 text-xs"
                    >
                      <UserCheck className="size-4 me-1.5" />
                      {t("friends.unblockUser")}
                    </Button>
                  </div>
                ))}
              </section>
            ) : null}
          </div>
        ) : null}

        {activeTab === "rooms" ? (
          <div className="space-y-2.5">
            {filteredRooms.length === 0 ? (
              <div
                data-testid="rooms-empty-state"
                className="rounded-2xl border border-border/60 bg-background/40 p-5 text-center space-y-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {t("chat.roomsEmptyTitle")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("chat.roomsEmptyDesc")}
                </p>
                <Button
                  type="button"
                  size="sm"
                  data-testid="rooms-empty-create-btn"
                  onClick={onOpenCreateRoom}
                  className="h-11 rounded-xl bg-primary px-4 text-primary-foreground"
                >
                  <Plus className="size-4 me-1.5" />
                  {t("chat.newRoom")}
                </Button>
              </div>
            ) : (
              <AnimatedList
                testId="chat-rooms-list"
                items={filteredRooms.map((room) => ({ key: room.id, room }))}
                renderItem={({ room }) => {
                  const accent = getRoomAccentStyle(room.accentColor);
                  const active = selectedConversationId === room.id;
                  const timeText = formatListTime(room.lastMessageAt, locale);
                  const preview = room.lastMessage
                    ? renderLastMessagePreview(room)
                    : t("chat.membersCount").replace("{count}", String(room.memberCount));

                  return (
                    <button
                      type="button"
                      data-testid={`chat-conv-room-${room.id}`}
                      onClick={() => onSelectConversation(room.id)}
                      className={cn(
                        "flex min-h-[60px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition-colors",
                        active
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/65 bg-background/45 hover:bg-muted/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-xl border text-lg",
                          accent.badge,
                        )}
                      >
                        {room.emoji || "💬"}
                      </span>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-foreground">
                            {room.name}
                          </p>
                          {timeText ? (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {timeText}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-muted-foreground">
                            {preview}
                          </p>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <Users className="size-3" />
                              {room.memberCount}
                            </span>
                            {room.muted ? (
                              <VolumeX className="size-3.5 text-muted-foreground" />
                            ) : null}
                            <UnreadPill count={room.muted ? 0 : room.unreadCount} />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                }}
              />
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
