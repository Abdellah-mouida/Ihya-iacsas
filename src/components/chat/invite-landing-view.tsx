"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, DoorOpen, Lock, ShieldAlert, X } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import type { LinkInvitePreviewDTO } from "@/lib/chat/rooms";
import { notify } from "@/lib/toast";

interface InviteLandingViewProps {
  token: string;
  invite: LinkInvitePreviewDTO | null;
}

export function InviteLandingView({ token, invite }: InviteLandingViewProps) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [declined, setDeclined] = useState(false);

  const formattedExpiry = invite
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(invite.expiresAt))
    : "";

  async function handleRespond(decision: "accept" | "decline") {
    if (!invite || pending) return;
    setPending(decision);
    try {
      const res = await fetch(
        `/api/chat/invites/link/${encodeURIComponent(token)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify.error(data.error || t("chatInvite.actionFailed"));
        return;
      }
      if (decision === "decline") {
        setDeclined(true);
        return;
      }
      notify.success(t("chatInvite.acceptedToast"));
      const targetRoomId =
        typeof data.roomId === "string" ? data.roomId : invite.roomId;
      router.push(`/chat?c=${encodeURIComponent(targetRoomId)}`);
      router.refresh();
    } catch {
      notify.error(t("chatInvite.actionFailed"));
    } finally {
      setPending(null);
    }
  }

  if (!invite) {
    return (
      <section
        data-testid="invite-unavailable"
        className="glass mx-auto max-w-md rounded-2xl border border-border/80 p-6 sm:p-8 text-center shadow-sm"
      >
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground">
          {t("chatInvite.unavailableTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t("chatInvite.unavailableDesc")}
        </p>
        <div className="mt-6">
          <Button asChild variant="outline" className="min-h-11 px-5">
            <Link href="/">{t("chatInvite.backToHome")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (declined) {
    return (
      <section
        data-testid="invite-declined"
        className="glass mx-auto max-w-md rounded-2xl border border-border/80 p-6 sm:p-8 text-center shadow-sm"
      >
        <h1 className="font-heading text-xl font-bold text-foreground">
          {t("chatInvite.declinedTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("chatInvite.declinedDesc")}
        </p>
        <div className="mt-6">
          <Button asChild variant="outline" className="min-h-11 px-5">
            <Link href="/">{t("chatInvite.backToHome")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  const inviterDisplay =
    invite.inviterName?.trim() || t("chatInvite.unknownInviter");

  return (
    <section
      data-testid="invite-preview-card"
      className="glass mx-auto max-w-md rounded-2xl border border-border/80 p-6 sm:p-8 shadow-sm"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Lock className="size-3.5 text-primary" aria-hidden="true" />
        <span>{t("chatInvite.badge")}</span>
      </div>

      <div className="mt-5 flex items-center gap-3.5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-2xl">
          <span aria-hidden="true">{invite.roomEmoji || "💬"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold text-foreground break-words">
            {invite.roomName}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("chatInvite.expiresLabel").replace("{date}", formattedExpiry)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-3">
        <UserAvatar
          id={invite.inviterId}
          src={invite.inviterImage}
          name={inviterDisplay}
          size="sm"
        />
        <p className="text-sm text-foreground">
          {t("chatInvite.invitedBy").replace("{name}", inviterDisplay)}
        </p>
      </div>

      {invite.alreadyMember ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("chatInvite.alreadyMember")}
          </p>
          <Button asChild className="w-full min-h-11 gap-2">
            <Link href={`/chat?c=${encodeURIComponent(invite.roomId)}`}>
              <DoorOpen className="size-4" aria-hidden="true" />
              <span>{t("chatInvite.openRoomBtn")}</span>
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Button
            type="button"
            className="flex-1 min-h-11 gap-2"
            disabled={pending !== null}
            onClick={() => handleRespond("accept")}
            data-testid="invite-accept-btn"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{t("chatInvite.acceptBtn")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-11 gap-2"
            disabled={pending !== null}
            onClick={() => handleRespond("decline")}
            data-testid="invite-decline-btn"
          >
            <X className="size-4" aria-hidden="true" />
            <span>{t("chatInvite.declineBtn")}</span>
          </Button>
        </div>
      )}
    </section>
  );
}
