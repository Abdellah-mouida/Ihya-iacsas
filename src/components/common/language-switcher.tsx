"use client";

import { Languages } from "lucide-react";

import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { toggleLocale, t } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t("lang.toggle")}
      className={cn(
        "glass inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-foreground/80 transition-all duration-300 hover:scale-105 hover:text-brass focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <Languages className="size-4" />
      <span>{t("lang.switchTo")}</span>
    </button>
  );
}
