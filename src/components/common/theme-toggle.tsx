"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Composited cross-fade via the View Transitions API — avoids the lag of
    // transitioning every element (backdrop-filters + WebGL canvas) at once.
    if (doc.startViewTransition && !reduce) {
      doc.startViewTransition(() => setTheme(next));
    } else {
      setTheme(next);
    }
  };

  return (
    <button
      type="button"
      aria-label={t("theme.toggle")}
      onClick={toggleTheme}
      className={cn(
        "glass group relative inline-flex size-10 items-center justify-center rounded-full text-foreground/80 transition-all duration-300 hover:scale-110 hover:text-brass focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {mounted ? (
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ y: 12, opacity: 0, rotate: -30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -12, opacity: 0, rotate: 30 }}
              transition={{ duration: 0.25 }}
            >
              <Moon className="size-5" />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ y: 12, opacity: 0, rotate: 30 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -12, opacity: 0, rotate: -30 }}
              transition={{ duration: 0.25 }}
            >
              <Sun className="size-5" />
            </motion.span>
          )}
        </AnimatePresence>
      ) : (
        <span className="size-5" />
      )}
    </button>
  );
}
