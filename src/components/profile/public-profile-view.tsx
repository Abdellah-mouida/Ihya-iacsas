"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import { useConfirmDialog } from "@/components/common/confirm-dialog";
import { PatternCover } from "@/components/common/pattern-cover";
import { UserAvatar } from "@/components/common/user-avatar";
import { CountUp } from "@/components/common/count-up";
import { Button } from "@/components/ui/button";
import rbStyles from "@/components/common/react-bits-adaptations.module.css";
import type { PublicProfileData } from "@/lib/chat/friends";

interface PublicProfileViewProps {
  initialProfile: PublicProfileData;
}

export function PublicProfileView({ initialProfile }: PublicProfileViewProps) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";
  const [profile, setProfile] = useState<PublicProfileData>(initialProfile);
  const [isPending, setIsPending] = useState(false);
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const runAction = async (
    action:
      | "send"
      | "cancel"
      | "accept"
      | "decline"
      | "unfriend"
      | "block"
      | "unblock",
  ) => {
    if (isPending) return;
    setIsPending(true);
    try {
      const res = await fetch("/api/chat/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetUserId: profile.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: string;
        error?: string;
      };

      if (!res.ok) {
        notify.error(data.error || t("friends.actionError"));
        return;
      }

      setProfile((prev) => {
        const next = { ...prev };
        switch (action) {
          case "send":
            next.relationship =
              data.status === "ACCEPTED" ? "FRIENDS" : "REQUEST_SENT";
            if (data.status === "ACCEPTED" && prev.friendCount !== null) {
              next.friendCount = prev.friendCount + 1;
            }
            break;
          case "cancel":
          case "decline":
            next.relationship = "NONE";
            break;
          case "accept":
            next.relationship = "FRIENDS";
            if (prev.friendCount !== null) {
              next.friendCount = prev.friendCount + 1;
            }
            break;
          case "unfriend":
            next.relationship = "NONE";
            if (prev.friendCount !== null && prev.friendCount > 0) {
              next.friendCount = prev.friendCount - 1;
            }
            break;
          case "block":
            next.relationship = "BLOCKED_BY_ME";
            next.friendCount = null;
            next.isOnline = null;
            next.bio = null;
            next.city = null;
            break;
          case "unblock":
            next.relationship = "NONE";
            break;
        }
        return next;
      });

      notify.success(t("friends.actionSuccess"));
      router.refresh();
    } catch {
      notify.error(t("friends.actionError"));
    } finally {
      setIsPending(false);
    }
  };

  const handleUnfriend = async () => {
    const confirmed = await confirm({
      title: t("friends.unfriendConfirmTitle"),
      description: t("friends.unfriendConfirmDesc"),
      variant: "destructive",
    });
    if (confirmed) {
      runAction("unfriend");
    }
  };

  const handleBlock = async () => {
    const confirmed = await confirm({
      title: t("friends.blockConfirmTitle"),
      description: t("friends.blockConfirmDesc"),
      variant: "destructive",
    });
    if (confirmed) {
      runAction("block");
    }
  };

  const displayName = profile.name || (isAr ? "عضو إحياء" : "Ihyaa Member");

  return (
    <div className="space-y-8" data-testid="public-profile-container">
      {ConfirmDialogComponent}

      <div
        data-testid="public-profile-header-card"
        data-rb="ProfileCard"
        className={`${rbStyles.profileCard} relative rounded-3xl border border-border/80 bg-card/70 backdrop-blur-xl transition-[box-shadow,border-color] duration-300`}
      >
        <div className="relative h-44 sm:h-60 w-full overflow-hidden rounded-t-3xl bg-muted/40">
          <PatternCover
            coverUrl={profile.coverImage}
            alt={displayName}
            imageWidth={profile.coverWidth}
            imageHeight={profile.coverHeight}
          />
        </div>

        <div className="relative flex min-w-0 flex-col gap-6 px-5 pb-8 pt-0 sm:flex-row sm:items-end sm:justify-between sm:px-10 -mt-14 sm:-mt-18">
          <div className="flex min-w-0 flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-start">
            <div className="relative rounded-full border-4 border-background bg-card shadow-profile-card ring-2 ring-primary/30 shrink-0 sm:-translate-y-10">
              <UserAvatar
                user={{
                  id: profile.id,
                  name: displayName,
                  image: profile.image,
                }}
                size="3xl"
                shape="circle"
              />
              {profile.isOnline !== null && (
                <span
                  aria-label={
                    profile.isOnline ? t("friends.online") : t("friends.offline")
                  }
                  className={`absolute bottom-1.5 end-1.5 size-4 rounded-full border-2 border-background ${
                    profile.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
              )}
            </div>

            <div className="min-w-0 w-full max-w-full space-y-2 sm:w-fit">
              <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-2xl bg-card/75 px-3 py-2 backdrop-blur-xl sm:w-fit sm:justify-start">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground break-words">
                  {displayName}
                </h1>
                {profile.relationship === "SELF" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <ShieldCheck className="size-3.5" />
                    {t("friends.ownProfileBadge")}
                  </span>
                )}
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-3 rounded-2xl bg-card/65 px-3 py-2 text-xs sm:text-sm text-muted-foreground backdrop-blur-xl sm:w-fit sm:justify-start">
                {profile.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 shrink-0 text-primary" />
                    <span>{profile.city}</span>
                  </span>
                )}
                {profile.friendCount !== null && (
                  <span
                    data-testid="public-profile-friend-count"
                    className="flex items-center gap-1 font-medium text-foreground/90"
                  >
                    <Users className="size-3.5 shrink-0 text-primary" />
                    <CountUp
                      value={profile.friendCount}
                      locale={locale}
                      className="tabular-nums font-semibold"
                    />
                    <span>{t("friends.friendCountLabel")}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Relationship Actions */}
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            {profile.relationship === "SELF" && (
              <Button asChild variant="outline" className="min-h-11 rounded-xl">
                <Link href="/profile">{t("friends.backToMyProfile")}</Link>
              </Button>
            )}

            {profile.relationship === "NONE" && (
              <>
                {profile.canReceiveFriendRequest ? (
                  <Button
                    type="button"
                    disabled={isPending}
                    data-testid="public-profile-add-friend"
                    onClick={() => runAction("send")}
                    className="min-h-11 rounded-xl gap-2 font-heading font-semibold"
                  >
                    <UserPlus className="size-4" />
                    <span>{t("friends.addFriend")}</span>
                  </Button>
                ) : (
                  <span
                    data-testid="public-profile-requests-disabled"
                    className="rounded-xl border border-border/70 bg-muted/50 px-3.5 py-2 text-xs text-muted-foreground"
                  >
                    {t("friends.requestsDisabled")}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-block"
                  onClick={handleBlock}
                  className="min-h-11 rounded-xl gap-2 text-destructive hover:text-destructive"
                >
                  <Ban className="size-4" />
                  <span>{t("friends.blockUser")}</span>
                </Button>
              </>
            )}

            {profile.relationship === "REQUEST_SENT" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-cancel-request"
                  onClick={() => runAction("cancel")}
                  className="min-h-11 rounded-xl gap-2 font-heading font-semibold"
                >
                  <X className="size-4" />
                  <span>{t("friends.cancelRequest")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-block"
                  onClick={handleBlock}
                  className="min-h-11 rounded-xl gap-2 text-destructive hover:text-destructive"
                >
                  <Ban className="size-4" />
                  <span>{t("friends.blockUser")}</span>
                </Button>
              </>
            )}

            {profile.relationship === "REQUEST_RECEIVED" && (
              <>
                <Button
                  type="button"
                  disabled={isPending}
                  data-testid="public-profile-accept-request"
                  onClick={() => runAction("accept")}
                  className="min-h-11 rounded-xl gap-2 font-heading font-semibold"
                >
                  <Check className="size-4" />
                  <span>{t("friends.acceptRequest")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-decline-request"
                  onClick={() => runAction("decline")}
                  className="min-h-11 rounded-xl gap-2"
                >
                  <X className="size-4" />
                  <span>{t("friends.declineRequest")}</span>
                </Button>
              </>
            )}

            {profile.relationship === "FRIENDS" && (
              <>
                <Button
                  asChild
                  data-testid="public-profile-message-btn"
                  className="min-h-11 rounded-xl gap-2 font-heading font-semibold"
                >
                  <Link href={`/chat?dm=${encodeURIComponent(profile.id)}`}>
                    <MessageCircle className="size-4" />
                    <span>{t("friends.messageFriend")}</span>
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-unfriend"
                  onClick={handleUnfriend}
                  className="min-h-11 rounded-xl gap-2"
                >
                  <UserMinus className="size-4" />
                  <span>{t("friends.unfriend")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  data-testid="public-profile-block"
                  onClick={handleBlock}
                  className="min-h-11 rounded-xl gap-2 text-destructive hover:text-destructive"
                >
                  <Ban className="size-4" />
                  <span>{t("friends.blockUser")}</span>
                </Button>
              </>
            )}

            {profile.relationship === "BLOCKED_BY_ME" && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                data-testid="public-profile-unblock"
                onClick={() => runAction("unblock")}
                className="min-h-11 rounded-xl gap-2"
              >
                <UserCheck className="size-4" />
                <span>{t("friends.unblockUser")}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {profile.relationship === "BLOCKED_BY_THEM" && (
        <div
          data-testid="public-profile-blocked-notice"
          className="rounded-2xl border border-border/80 bg-card/70 p-6 text-sm text-muted-foreground"
        >
          {t("friends.blockedByThemNotice")}
        </div>
      )}

      {profile.relationship === "BLOCKED_BY_ME" && (
        <div
          data-testid="public-profile-blocked-by-me-notice"
          className="rounded-2xl border border-border/80 bg-card/70 p-6 text-sm text-muted-foreground"
        >
          {t("friends.blockedByMeNotice")}
        </div>
      )}

      {profile.bio &&
        profile.relationship !== "BLOCKED_BY_ME" &&
        profile.relationship !== "BLOCKED_BY_THEM" && (
          <div
            data-testid="public-profile-bio-card"
            className="rounded-3xl border border-border/80 bg-card/65 p-6 sm:p-8 backdrop-blur-xl space-y-3"
          >
            <h2 className="text-sm font-heading font-bold text-primary">
              {isAr ? "نبذة شخصية" : "About"}
            </h2>
            <blockquote className="border-s-4 border-primary/50 ps-4 py-1 text-sm sm:text-base text-foreground font-serif italic leading-relaxed">
              «{profile.bio}»
            </blockquote>
          </div>
        )}
    </div>
  );
}
