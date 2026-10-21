"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

import { LocaleProvider } from "@/i18n/locale-provider";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "@/lib/toast";

export function Providers({ children }: { children: ReactNode }) {
  // Ensure toast is accessible in browser runtime / testing
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __IHYAA_TOAST__?: typeof toast }).__IHYAA_TOAST__ = toast;
    }
  }, []);
  // Enable color transitions only after the first paint, so switching the
  // theme animates smoothly but the initial load doesn't flash.
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      document.documentElement.classList.add("theme-ready"),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LocaleProvider>
          {children}
          <Toaster position="top-center" closeButton />
        </LocaleProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
