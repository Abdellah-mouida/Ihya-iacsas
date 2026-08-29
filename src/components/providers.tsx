"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

import { LocaleProvider } from "@/i18n/locale-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  // Enable color transitions only after the first paint, so switching the
  // theme animates smoothly but the initial load doesn't flash.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      document.documentElement.classList.add("theme-ready"),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LocaleProvider>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </LocaleProvider>
    </ThemeProvider>
  );
}
