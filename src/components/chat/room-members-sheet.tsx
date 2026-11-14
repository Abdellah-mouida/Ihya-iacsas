"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Crown,
  Link2,
  LogOut,
  Send,
  ShieldAlert,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountUp } from "@/components/common/count-up";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { UserAvatar } from "@/components/common/user-avatar";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import type { ChatUserSummary, RoomDetailsState } from "./chat-types";

export function RoomMembersSheet({
  roomId,
  open,
  onOpenChange,
  currentUserId,
  friends,
  onRoomUpdated,
  onRoomLeftOrDeleted,
}: {
  roomId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  friends: ChatUserSummary[];
  onRoomUpdated: () => void;
  onRoomLeftOrDeleted: (roomId: string) => void;
}) {
  const { t, locale } = useLocale();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();
  const [details, setDetails] = useState<RoomDetailsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string>("__open__");
  const [busyAction, setBusyAction] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    if (!roomId || !open) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/rooms/${roomId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { room?: RoomDetailsState };
      if (data.room) setDetails(data.room);
    } finally {
      setLoading(false);
    }
  }, [roomId, open]);

  useEffect(() => {
    if (!roomId || !open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) void loadRoom();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadRoom, open, roomId]);

  const memberUserIds = new Set(details?.members.map((m) => m.userId) ?? []);
  const invitableFriends = friends.filter((f) => !memberUserIds.has(f.id));
  const isOwner = details?.myRole === "OWNER";
  const canInvite = Boolean(details && (isOwner || details.membersCanInvite));

  async function toggleMembersCanInvite() {
    if (!details || !isOwner || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/chat/rooms/${details.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membersCanInvite: !details.membersCanInvite }),
      });
      if (!res.ok) {
        notify.error(t("chat.actionError"));
        return;
      }
      await loadRoom();
      onRoomUpdated();
    } finally {
      setBusyAction(false);
    }
  }

  async function sendDmInvite() {
    if (!details || selectedFriendId === "__open__" || busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/chat/rooms/${details.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "MESSAGE", inviteeId: selectedFriendId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify.error(data.error || t("chat.actionError"));
        return;
      }
      notify.success(t("chat.dmInviteSentToast"));
      await loadRoom();
    } finally {
      setBusyAction(false);
    }
  }

  async function createLinkInvite() {
    if (!details || busyAction) return;
    setBusyAction(true);
    try {
      const targetId = selectedFriendId === "__open__" ? null : selectedFriendId;
      const res = await fetch(`/api/chat/rooms/${details.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "LINK",
          inviteeId: targetId,
          maxUses: targetId ? 1 : 5,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        inviteUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.inviteUrl) {
        notify.error(data.error || t("chat.actionError"));
        return;
      }
      const fullUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${data.inviteUrl}`
          : data.inviteUrl;
      setCopiedLink(fullUrl);
      await navigator.clipboard?.writeText(fullUrl).catch(() => {});
      notify.success(t("chat.copyLinkSuccess"));
      await loadRoom();
    } finally {
      setBusyAction(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (busyAction) return;
    setBusyAction(true);
    try {
      const res = await fetch(`/api/chat/invites/item/${inviteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        notify.error(t("chat.actionError"));
        return;
      }
      notify.success(t("chat.linkRevokedToast"));
      await loadRoom();
    } finally {
      setBusyAction(false);
    }
  }

  async function handleRemoveMember(memberUserId: string, name: string) {
    if (!details) return;
    const ok = await confirm({
      title: t("chat.removeMemberTitle"),
      description: t("chat.removeMemberDesc").replace("{name}", name),
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/chat/rooms/${details.id}/members/${memberUserId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return;
    }
    await loadRoom();
    onRoomUpdated();
  }

  async function handleTransferOwner(memberUserId: string, name: string) {
    if (!details) return;
    const ok = await confirm({
      title: t("chat.transferOwnerTitle"),
      description: t("chat.transferOwnerDesc").replace("{name}", name),
    });
    if (!ok) return;
    const res = await fetch(`/api/chat/rooms/${details.id}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newOwnerId: memberUserId }),
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return;
    }
    await loadRoom();
    onRoomUpdated();
  }

  async function handleLeaveRoom() {
    if (!details) return;
    const ok = await confirm({
      title: t("chat.leaveRoomTitle"),
      description: t("chat.leaveRoomDesc"),
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/chat/rooms/${details.id}/leave`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      notify.error(data.error || t("chat.actionError"));
      return;
    }
    onOpenChange(false);
    onRoomLeftOrDeleted(details.id);
  }

  async function handleDeleteRoom() {
    if (!details) return;
    const ok = await confirm({
      title: t("chat.deleteRoomTitle"),
      description: t("chat.deleteRoomDesc"),
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/chat/rooms/${details.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      notify.error(t("chat.actionError"));
      return;
    }
    onOpenChange(false);
    onRoomLeftOrDeleted(details.id);
  }

  const pendingLinks =
    details?.invites.filter((inv) => inv.kind === "LINK" && inv.status === "PENDING") ??
    [];

  return (
    <>
      {ConfirmDialogComponent}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="room-members-dialog"
          className="glass-strong max-h-[90dvh] overflow-y-auto rounded-3xl border-border/80 sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
              <span>{details?.emoji || "💬"}</span>
              <span className="truncate">{details?.name || t("chat.roomPanelTitle")}</span>
            </DialogTitle>
          </DialogHeader>

          {loading && !details ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : details ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-background/50 px-3.5 py-2.5 text-sm">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Users className="size-4 text-primary" />
                  <CountUp value={details.memberCount} locale={locale} />
                  <span className="text-muted-foreground font-normal">
                    / {details.memberCap}
                  </span>
                </div>

                {isOwner ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                    <input
                      type="checkbox"
                      data-testid="room-members-can-invite-toggle"
                      checked={details.membersCanInvite}
                      onChange={toggleMembersCanInvite}
                      disabled={busyAction}
                      className="size-4 accent-primary"
                    />
                    <span>{t("chat.membersCanInviteLabel")}</span>
                  </label>
                ) : null}
              </div>

              {canInvite ? (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-3.5">
                  <p className="text-xs font-semibold text-foreground">
                    {t("chat.inviteFriendTitle")}
                  </p>
                  <Select value={selectedFriendId} onValueChange={setSelectedFriendId}>
                    <SelectTrigger
                      data-testid="room-invite-friend-select"
                      className="h-10 rounded-xl"
                    >
                      <SelectValue placeholder={t("chat.selectFriendPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__open__">
                        {t("chat.openFriendLinkOption")}
                      </SelectItem>
                      {invitableFriends.map((friend) => (
                        <SelectItem key={friend.id} value={friend.id}>
                          {friend.name || friend.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="room-send-dm-invite-btn"
                      disabled={busyAction || selectedFriendId === "__open__"}
                      onClick={sendDmInvite}
                      className="rounded-xl"
                    >
                      <Send className="size-3.5 me-1.5" />
                      {t("chat.sendDmInviteBtn")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid="room-create-link-invite-btn"
                      disabled={busyAction}
                      onClick={createLinkInvite}
                      className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Link2 className="size-3.5 me-1.5" />
                      {t("chat.createLinkBtn")}
                    </Button>
                  </div>

                  {copiedLink ? (
                    <div
                      data-testid="room-generated-invite-link"
                      className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs"
                    >
                      <span dir="ltr" className="truncate font-mono text-foreground">
                        {copiedLink}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(copiedLink).catch(() => {});
                          notify.success(t("chat.copyLinkSuccess"));
                        }}
                        className="shrink-0 text-primary"
                        aria-label={t("chat.copyLinkSuccess")}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  ) : null}

                  {pendingLinks.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("chat.activeLinksHeading")}
                      </p>
                      {pendingLinks.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/60 px-2.5 py-1.5 text-xs"
                        >
                          <span className="truncate text-foreground">
                            {inv.inviteeName || t("chat.openFriendLinkOption")} (
                            {inv.uses}/{inv.maxUses}) ·{" "}
                            {new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
                              month: "short",
                              day: "numeric",
                            }).format(new Date(inv.expiresAt))}
                          </span>
                          {(isOwner || inv.inviterId === currentUserId) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeInvite(inv.id)}
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            >
                              {t("chat.revokeLinkBtn")}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("chat.membersBtn")} ({details.memberCount})
                </p>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pe-1">
                  {details.members.map((member) => {
                    const memberName = member.name || t("chatInvite.unknownInviter");
                    const isSelf = member.userId === currentUserId;
                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/45 px-3 py-2"
                      >
                        <Link
                          href={`/u/${member.userId}`}
                          className="flex min-w-0 items-center gap-2.5 hover:opacity-85"
                        >
                          <div className="relative shrink-0">
                            <UserAvatar
                              user={{ name: member.name, image: member.image }}
                              size="sm"
                              shape="circle"
                            />
                            {member.isOnline ? (
                              <span className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full border-2 border-card bg-green" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {memberName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {member.role === "OWNER" ? (
                                <span className="inline-flex items-center gap-1 text-brass font-semibold">
                                  <Crown className="size-3" />
                                  {t("chat.ownerBadge")}
                                </span>
                              ) : (
                                t("chat.memberBadge")
                              )}
                            </p>
                          </div>
                        </Link>

                        {isOwner && !isSelf ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTransferOwner(member.userId, memberName)}
                              aria-label={t("chat.transferOwnerBtn")}
                              title={t("chat.transferOwnerBtn")}
                              className="size-8 rounded-lg text-brass hover:bg-brass/10"
                            >
                              <Crown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(member.userId, memberName)}
                              aria-label={t("chat.removeMemberBtn")}
                              title={t("chat.removeMemberBtn")}
                              className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                            >
                              <UserMinus className="size-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLeaveRoom}
                  disabled={isOwner && details.memberCount > 1}
                  className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <LogOut className="size-4 me-1.5" />
                  {t("chat.leaveRoomBtn")}
                </Button>

                {isOwner ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteRoom}
                    className="rounded-xl"
                  >
                    <Trash2 className="size-4 me-1.5" />
                    {t("chat.deleteRoomBtn")}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldAlert className="size-3.5" />
                    {details.membersCanInvite ? (
                      <Check className="size-3.5 text-primary" />
                    ) : null}
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
