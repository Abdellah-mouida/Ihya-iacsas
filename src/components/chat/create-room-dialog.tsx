"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/common/user-avatar";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  type ChatUserSummary,
  ROOM_ACCENT_STYLES,
  ROOM_EMOJIS,
  type RoomAccentToken,
} from "./chat-types";

const ACCENT_OPTIONS: Array<{ value: RoomAccentToken; labelKey: string }> = [
  { value: "main", labelKey: "chat.roomColorMain" },
  { value: "brass", labelKey: "chat.roomColorBrass" },
  { value: "gold", labelKey: "chat.roomColorGold" },
  { value: "sage", labelKey: "chat.roomColorSage" },
];

export function CreateRoomDialog({
  open,
  onOpenChange,
  friends,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: ChatUserSummary[];
  onCreated: (roomId: string) => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(ROOM_EMOJIS[0]);
  const [accentColor, setAccentColor] = useState<RoomAccentToken>("main");
  const [memberCap, setMemberCap] = useState(50);
  const [membersCanInvite, setMembersCanInvite] = useState(true);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.slice(0, 9).concat(id),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          emoji,
          accentColor,
          memberCap: Math.min(50, Math.max(2, Number(memberCap) || 50)),
          membersCanInvite,
          inviteFriendIds: selectedFriends,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        room?: { id: string };
        error?: string;
      };
      if (!res.ok || !data.room?.id) {
        notify.error(data.error || t("chat.actionError"));
        return;
      }
      notify.success(t("chat.roomCreatedToast"));
      setName("");
      setSelectedFriends([]);
      onOpenChange(false);
      onCreated(data.room.id);
    } catch {
      notify.error(t("chat.actionError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="create-room-dialog"
        className="glass-strong max-h-[90dvh] overflow-y-auto rounded-3xl border-border/80 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-foreground">
            {t("chat.createRoomTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("chat.createRoomDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="chat-room-name">{t("chat.roomNameLabel")}</Label>
            <Input
              id="chat-room-name"
              data-testid="create-room-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("chat.roomNamePlaceholder")}
              minLength={2}
              maxLength={60}
              required
              className="h-11 rounded-xl"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("chat.roomEmojiLabel")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_EMOJIS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setEmoji(item)}
                    className={cn(
                      "grid size-9 place-items-center rounded-xl border text-base transition-colors",
                      emoji === item
                        ? "border-primary bg-primary/15"
                        : "border-border/70 bg-background/50 hover:border-primary/40",
                    )}
                    aria-pressed={emoji === item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("chat.roomColorLabel")}</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ACCENT_OPTIONS.map((opt) => {
                  const style = ROOM_ACCENT_STYLES[opt.value];
                  const active = accentColor === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAccentColor(opt.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/70 bg-background/50 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className={cn("size-2.5 rounded-full", style.dot)} />
                      <span>{t(opt.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="chat-room-cap">{t("chat.roomCapLabel")}</Label>
              <Input
                id="chat-room-cap"
                type="number"
                min={2}
                max={50}
                value={memberCap}
                onChange={(e) => setMemberCap(Number(e.target.value))}
                className="h-10 rounded-xl"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 text-sm font-medium">
              <span>{t("chat.membersCanInviteLabel")}</span>
              <input
                type="checkbox"
                data-testid="create-room-members-can-invite"
                checked={membersCanInvite}
                onChange={(e) => setMembersCanInvite(e.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
          </div>

          {friends.length > 0 ? (
            <div className="space-y-2">
              <Label>{t("chat.initialFriendsLabel")}</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-border/70 bg-background/40 p-2">
                {friends.map((friend) => {
                  const picked = selectedFriends.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      data-testid={`create-room-friend-${friend.id}`}
                      onClick={() => toggleFriend(friend.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-start text-sm transition-colors",
                        picked ? "bg-primary/15 text-foreground" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <UserAvatar user={friend} size="sm" shape="circle" />
                        <span className="truncate font-medium">
                          {friend.name || t("chatInvite.unknownInviter")}
                        </span>
                      </span>
                      {picked ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              {t("chat.cancelEdit")}
            </Button>
            <Button
              type="submit"
              data-testid="create-room-submit-btn"
              disabled={submitting || name.trim().length < 2}
              className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="size-4 animate-spin me-2" /> : null}
              {t("chat.createRoomSubmit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
