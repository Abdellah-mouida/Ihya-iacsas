"use client";

import { useState } from "react";
import { ShieldCheck, Lock, MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/common/spotlight-card";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import rbStyles from "@/components/common/react-bits-adaptations.module.css";

export function ChatTermsGate({
  onAccepted,
}: {
  onAccepted: () => void;
}) {
  const { t } = useLocale();
  const [submitting, setSubmitting] = useState(false);

  async function handleAccept() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      if (!res.ok) {
        notify.error(t("chat.guidelinesError"));
        return;
      }
      onAccepted();
    } catch {
      notify.error(t("chat.guidelinesError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="chat-terms-gate"
      className="mx-auto flex max-w-2xl items-center justify-center px-4 py-12 sm:py-20"
    >
      <SpotlightCard
        className={`${rbStyles.animatedContent} glass-strong w-full rounded-3xl border border-border/75 p-6 shadow-layered sm:p-8`}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary">
                {t("chat.guidelinesBadge")}
              </p>
              <h1
                data-rb="ShinyText"
                className={`${rbStyles.shinyText} font-heading text-2xl font-bold text-foreground`}
              >
                {t("chat.guidelinesTitle")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("chat.guidelinesIntro")}
              </p>
            </div>
          </div>

          <ul className="space-y-3 text-sm text-foreground/90">
            <li className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5">
              <MessageSquareHeart className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t("chat.guidelinesRule1")}</span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brass" />
              <span>{t("chat.guidelinesRule2")}</span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-3.5">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{t("chat.guidelinesRule3")}</span>
            </li>
          </ul>

          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="chat-terms-accept-btn"
              disabled={submitting}
              onClick={handleAccept}
              className="h-11 rounded-xl bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t("chat.guidelinesAccept")}
            </Button>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
