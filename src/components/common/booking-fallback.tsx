"use client";

import { useLocale } from "@/i18n/locale-provider";
import { IslamicLoader } from "./islamic-loader";

export function BookingFallback() {
  const { t } = useLocale();

  return (
    <div
      data-testid="booking-loading"
      className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center py-20 min-h-[420px]"
    >
      <div className="glass relative flex w-full max-w-md flex-col items-center justify-center rounded-3xl p-10 ring-1 ring-border/60 shadow-layered">
        <IslamicLoader size="lg" message={t("booking.loading")} />
      </div>
    </div>
  );
}
