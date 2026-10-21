"use client";

import { Moon, Sun, Palette, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { ThemeDto, BUILT_IN_THEMES } from "@/lib/theme-constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle({
  className,
  onDark = false,
}: {
  className?: string;
  onDark?: boolean;
}) {
  const { setTheme, theme } = useTheme();
  const { locale, t } = useLocale();
  const isAr = locale === "ar";
  const [mounted, setMounted] = useState(false);
  const [themesList, setThemesList] = useState<ThemeDto[]>(() =>
    BUILT_IN_THEMES.map((b, idx) => ({
      id: `builtin-${idx}`,
      slug: b.slug,
      nameAr: b.nameAr,
      nameEn: b.nameEn,
      mode: b.mode as "light" | "dark",
      tokens: b.tokens,
      enabled: b.enabled,
      builtIn: b.builtIn,
      createdAt: "",
      updatedAt: "",
    }))
  );

  useEffect(() => {
    setMounted(true);
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.themes) && data.themes.length > 0) {
          setThemesList(data.themes);
        }
      })
      .catch(() => {});
  }, []);

  const selectTheme = (th: ThemeDto) => {
    setTheme(th.mode === "dark" ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", th.slug);
    try {
      localStorage.setItem("ihyaa-theme", th.slug);
      document.cookie = `ihyaa-theme=${th.slug}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  };

  const currentSlug =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") || (theme === "dark" ? "black" : "light")
      : theme === "dark"
        ? "black"
        : "light";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("theme.toggle")}
          data-testid="navbar-theme-toggle"
          className={cn(
            "group relative inline-flex size-10 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 hover:text-brass focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            onDark
              ? "text-foreground dark:text-white/90 hover:text-brass dark:hover:text-white"
              : "glass text-foreground/85 hover:text-foreground",
            className,
          )}
        >
          {mounted ? (
            theme === "dark" ? (
              <Moon className="size-5" />
            ) : (
              <Sun className="size-5" />
            )
          ) : (
            <span className="size-5" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-2xl border border-border/70 bg-popover/95 p-1.5 shadow-layered backdrop-blur-xl"
      >
        {themesList.map((th) => {
          const isSelected = currentSlug === th.slug;
          const bg = (th.tokens as Record<string, string>)?.["--background"] || (th.mode === "dark" ? "#111" : "#fff");
          const primary = (th.tokens as Record<string, string>)?.["--primary"] || (th.mode === "dark" ? "#eab308" : "#0a5417");

          return (
            <DropdownMenuItem
              key={th.slug}
              data-testid={`theme-option-${th.slug}`}
              onClick={() => selectTheme(th)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="size-3.5 rounded-full border border-black/10 dark:border-white/20 shadow-xs"
                  style={{ backgroundColor: bg }}
                />
                <span className="font-heading text-xs">
                  {isAr ? th.nameAr : th.nameEn}
                </span>
              </div>
              {isSelected ? <Check className="size-4 text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
