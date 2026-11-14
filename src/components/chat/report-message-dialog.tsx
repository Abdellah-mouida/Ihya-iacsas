"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/i18n/locale-provider";
import { notify } from "@/lib/toast";
import type { ChatMessageItem } from "./chat-types";

export function ReportMessageDialog({
  message,
  onOpenChange,
}: {
  message: ChatMessageItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLocale();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || submitting) return;
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          reason: trimmed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (!res.ok) {
        if (data.code === "ALREADY_REPORTED") {
          notify.info(t("chat.reportAlreadyReported"));
        } else {
          notify.error(data.error || t("chat.actionError"));
        }
        return;
      }
      notify.success(t("chat.reportSent"));
      setReason("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(message)}
      onOpenChange={(open) => {
        if (!open) setReason("");
        onOpenChange(open);
      }}
    >
      <DialogContent data-testid="chat-report-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-destructive" />
            <span>{t("chat.reportTitle")}</span>
          </DialogTitle>
          <DialogDescription>{t("chat.reportSubtitle")}</DialogDescription>
        </DialogHeader>

        {message ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">
                {message.sender?.name || t("chat.anonymizedAuthor")}
              </p>
              <p dir="auto" className="mt-1 line-clamp-3 whitespace-pre-wrap break-words">
                {message.body}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chat-report-reason">
                {t("chat.reportReasonLabel")}
              </Label>
              <Textarea
                id="chat-report-reason"
                data-testid="chat-report-reason-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("chat.reportReasonPlaceholder")}
                minLength={3}
                maxLength={500}
                rows={3}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("chat.cancelEdit")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                data-testid="chat-report-submit-btn"
                disabled={submitting || reason.trim().length < 3}
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                <span>{t("chat.reportSubmit")}</span>
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
