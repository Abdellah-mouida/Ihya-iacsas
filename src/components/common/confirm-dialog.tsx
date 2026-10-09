"use client";

import * as React from "react";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "default";
}

export interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText,
  variant = "destructive",
  loading = false,
}: ConfirmDialogProps) {
  const { locale } = useLocale();

  const isAr = locale === "ar";
  const defaultTitle =
    title ||
    (variant === "destructive"
      ? isAr
        ? "تأكيد الإجراء"
        : "Confirm Action"
      : isAr
        ? "تنبيه"
        : "Notice");

  const defaultConfirmText =
    confirmText ||
    (variant === "destructive"
      ? isAr
        ? "تأكيد الحذف"
        : "Confirm Delete"
      : isAr
        ? "موافق"
        : "Confirm");

  const defaultCancelText = cancelText || (isAr ? "إلغاء" : "Cancel");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="confirm-dialog"
        className="max-w-md border border-brass/25 bg-card/95 p-6 backdrop-blur-xl shadow-layered"
      >
        <div className="flex flex-col items-center text-center sm:items-start sm:text-start gap-4">
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl border",
              variant === "destructive" &&
                "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
              variant === "warning" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
              variant === "default" &&
                "border-brass/30 bg-brass/10 text-brass",
            )}
          >
            {variant === "destructive" ? (
              <Trash2 className="size-6" />
            ) : variant === "warning" ? (
              <AlertTriangle className="size-6" />
            ) : (
              <HelpCircle className="size-6" />
            )}
          </div>

          <div className="space-y-1.5 w-full">
            <DialogHeader className="p-0 text-center sm:text-start">
              <DialogTitle
                data-testid="confirm-dialog-title"
                className="font-heading text-lg font-bold text-foreground"
              >
                {defaultTitle}
              </DialogTitle>
              <DialogDescription
                data-testid="confirm-dialog-description"
                className="text-sm text-muted-foreground leading-relaxed"
              >
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            data-testid="confirm-dialog-cancel"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl border-border/60 hover:bg-muted/80"
          >
            {defaultCancelText}
          </Button>
          <Button
            type="button"
            data-testid="confirm-dialog-confirm"
            onClick={() => onConfirm()}
            disabled={loading}
            className={cn(
              "rounded-xl font-semibold shadow-sm transition-all",
              variant === "destructive" &&
                "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700",
              variant === "warning" &&
                "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700",
              variant === "default" &&
                "bg-brass text-night hover:bg-brass/90",
            )}
          >
            {defaultConfirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Promise-based hook for easy drop-in confirmation dialogs
 */
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean;
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  }>({
    open: false,
    options: { description: "" },
    resolve: () => {},
  });

  const confirm = React.useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          options,
          resolve,
        });
      });
    },
    [],
  );

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        state.resolve(false);
      }
      setState((prev) => ({ ...prev, open }));
    },
    [state],
  );

  const handleConfirm = React.useCallback(() => {
    state.resolve(true);
    setState((prev) => ({ ...prev, open: false }));
  }, [state]);

  const ConfirmDialogComponent = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      title={state.options.title}
      description={state.options.description}
      confirmText={state.options.confirmText}
      cancelText={state.options.cancelText}
      variant={state.options.variant}
    />
  );

  return { confirm, ConfirmDialogComponent };
}
