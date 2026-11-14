"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Globe2,
  Lock,
  MessageSquarePlus,
  Plus,
  Search,
  UserCheck,
  UserPlus,
  Users,
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

function UnreadPill({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        styles.unreadBadgePop,
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-none text-primary-foreground",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function ChatSidebar({
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
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [userResults, setUserResults] = useState<ChatUserSummary[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

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

  const publicConv = conversations.find((c) => c.type === "PUBLIC") ?? null;
  const dmConvs = conversations.filter((c) => c.type === "DM");
  const roomConvs = conversations.filter((c) => c.type === "ROOM");

  const publicUnread = publicConv?.unreadCount ?? 0;
  const friendsUnread =
    dmConvs.reduce((acc, c) => acc + c.unreadCount, 0) +
    friendsData.incomingRequests.length;
  const roomsUnread = roomConvs.reduce((acc, c) => acc + c.unreadCount, 0);

  const lower = trimmedSearch.toLowerCase();
  const filteredDms = lower
    ? dmConvs.filter((c) => (c.peer?.name || "").toLowerCase().includes(lower))
    : dmConvs;
  const filteredFriends = lower
    ? friendsData.friends.filter((f) =>
        (f.name || "").toLowerCase().includes(lower),
      )
    : friendsData.friends;
  const filteredRooms = lower
    ? roomConvs.filter((r) => (r.name || "").toLowerCase().includes(lower))
    : roomConvs;

  const friendIds = new Set(friendsData.friends.map((f) => f.id));
  const incomingIds = new Set(friendsData.incomingRequests.map((r) => r.user.id));
  const outgoingIds = new Set(friendsData.outgoingRequests.map((r) => r.user.id));

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
            {t("chat.pageTitle")}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {t("chat.pageSubtitle")}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          data-testid="chat-new-room-btn"
          onClick={onOpenCreateRoom}
          className="h-9 shrink-0 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4 me-1" />
          <span className="hidden sm:inline">{t("chat.newRoom")}</span>
        </Button>
      </div>

      <div className="border-b border-border/60 px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="chat-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.searchPlaceholder")}
            className="h-9 rounded-xl ps-9 pe-8 text-xs"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label={t("common.close")}
              className="absolute top-1/2 end-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
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
                          className="h-7 rounded-lg px-2 text-xs"
                        >
                          {t("chat.openDm")}
                        </Button>
                      ) : isIncoming ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void onFriendAction("accept", user.id)}
                          className="h-7 rounded-lg bg-primary px-2 text-xs text-primary-foreground"
                        >
                          {t("friends.acceptRequest")}
                        </Button>
                      ) : isOutgoing ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onFriendAction("cancel", user.id)}
                          className="h-7 rounded-lg px-2 text-xs"
                        >
                          {t("friends.requestSent")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void onFriendAction("send", user.id)}
                          className="h-7 rounded-lg px-2 text-xs"
                        >
                          <UserPlus className="size-3 me-1" />
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
        className="grid grid-cols-3 gap-1 border-b border-border/60 bg-muted/25 p-1.5"
      >
        {(
          [
            { id: "public", label: t("chat.tabPublic"), count: publicUnread, Icon: Globe2 },
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
                "flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm border border-border/70"
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">
        {activeTab === "public" ? (
          <div className="space-y-2">
            {publicConv ? (
              <button
                type="button"
                data-testid="chat-conv-public"
                onClick={() => onSelectConversation(publicConv.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-start transition-colors",
                  selectedConversationId === publicConv.id
                    ? "border-primary/45 bg-primary/10"
                    : "border-border/70 bg-background/50 hover:bg-muted/40",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-lg">
                    {publicConv.emoji || "🌙"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">
                      {t("chat.publicSpaceTitle")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {publicConv.lastMessage && !publicConv.lastMessage.deleted
                        ? publicConv.lastMessage.decryptionFailed
                          ? t("chat.messageUnavailable")
                          : publicConv.lastMessage.body
                        : t("chat.publicSpaceDesc")}
                    </p>
                  </div>
                </div>
                <UnreadPill count={publicConv.unreadCount} />
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === "friends" ? (
          <div className="space-y-4">
            {(friendsData.incomingRequests.length > 0 ||
              friendsData.outgoingRequests.length > 0) && (
              <section className="space-y-2" data-testid="chat-requests-inbox">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("chat.requestsInbox")}
                </p>

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
                          className="size-8 rounded-xl bg-primary text-primary-foreground"
                        >
                          <Check className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => void onFriendAction("decline", req.user.id)}
                          aria-label={t("friends.declineRequest")}
                          className="size-8 rounded-xl"
                        >
                          <X className="size-3.5" />
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
                      className="h-7 rounded-lg px-2 text-xs text-muted-foreground"
                    >
                      {t("friends.cancelRequest")}
                    </Button>
                  </div>
                ))}
              </section>
            )}

            {filteredDms.length > 0 ? (
              <section className="space-y-1.5">
                <AnimatedList
                  testId="chat-dm-list"
                  items={filteredDms.map((conv) => ({ key: conv.id, conv }))}
                  renderItem={({ conv }) => {
                    const peerOnline =
                      conv.peer?.isOnline === null
                        ? false
                        : Boolean(
                            conv.peer?.isOnline ||
                              (conv.peer?.id && onlineUsers.has(conv.peer.id)),
                          );
                    const active = selectedConversationId === conv.id;
                    return (
                      <button
                        type="button"
                        data-testid={`chat-conv-dm-${conv.peer?.id ?? conv.id}`}
                        onClick={() => onSelectConversation(conv.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3 py-2.5 text-start transition-colors",
                          active
                            ? "border-primary/45 bg-primary/10"
                            : "border-border/65 bg-background/45 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="relative shrink-0">
                            <UserAvatar
                              user={conv.peer ?? { name: conv.name }}
                              size="sm"
                              shape="circle"
                            />
                            {peerOnline ? (
                              <span
                                data-online="true"
                                className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card bg-green"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {conv.peer?.name || t("chatInvite.unknownInviter")}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {conv.lastMessage
                                ? conv.lastMessage.deleted
                                  ? t("chat.deletedMessage")
                                  : conv.lastMessage.decryptionFailed
                                    ? t("chat.messageUnavailable")
                                    : conv.lastMessage.type === "ROOM_INVITE"
                                      ? t("chatInvite.badge")
                                      : conv.lastMessage.body
                                : t("chat.openDm")}
                            </p>
                          </div>
                        </div>
                        <UnreadPill count={conv.unreadCount} />
                      </button>
                    );
                  }}
                />
              </section>
            ) : null}

            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("chat.friendsListHeading").replace(
                  "{count}",
                  String(friendsData.friends.length),
                )}
              </p>
              {filteredFriends.length === 0 ? (
                <p className="rounded-2xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                  {t("chat.noFriends")}
                </p>
              ) : (
                <AnimatedList
                  testId="chat-friends-list"
                  items={filteredFriends.map((f) => ({ key: f.id, friend: f }))}
                  renderItem={({ friend }) => {
                    const isOnline =
                      friend.isOnline === null
                        ? false
                        : Boolean(friend.isOnline || onlineUsers.has(friend.id));
                    return (
                      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/45 px-3 py-2">
                        <Link
                          href={`/u/${friend.id}`}
                          className="flex min-w-0 items-center gap-2.5 hover:opacity-85"
                        >
                          <div className="relative shrink-0">
                            <UserAvatar user={friend} size="sm" shape="circle" />
                            {isOnline ? (
                              <span
                                data-online="true"
                                className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card bg-green"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {friend.name || t("chatInvite.unknownInviter")}
                            </p>
                            {friend.city ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {friend.city}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`open-dm-${friend.id}`}
                          onClick={() => onOpenDm(friend.id)}
                          className="h-7 shrink-0 rounded-lg px-2 text-xs"
                        >
                          <MessageSquarePlus className="size-3.5 me-1" />
                          {t("chat.openDm")}
                        </Button>
                      </div>
                    );
                  }}
                />
              )}
            </section>

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
                      className="h-7 px-2 text-xs"
                    >
                      <UserCheck className="size-3.5 me-1" />
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
            <p className="text-xs font-semibold text-muted-foreground">
              {t("chat.roomsHeading").replace("{count}", String(roomConvs.length))}
            </p>
            {filteredRooms.length === 0 ? (
              <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-center text-xs text-muted-foreground space-y-3">
                <p>{t("chat.noRooms")}</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={onOpenCreateRoom}
                  className="rounded-xl bg-primary text-primary-foreground"
                >
                  <Plus className="size-3.5 me-1" />
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
                  return (
                    <button
                      type="button"
                      data-testid={`chat-conv-room-${room.id}`}
                      onClick={() => onSelectConversation(room.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3 py-2.5 text-start transition-colors",
                        active
                          ? "border-primary/45 bg-primary/10"
                          : "border-border/65 bg-background/45 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-xl border text-base",
                            accent.badge,
                          )}
                        >
                          {room.emoji || "💬"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {room.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t("chat.membersCount").replace(
                              "{count}",
                              String(room.memberCount),
                            )}
                          </p>
                        </div>
                      </div>
                      <UnreadPill count={room.unreadCount} />
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
