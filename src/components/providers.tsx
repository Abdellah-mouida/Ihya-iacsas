"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { LocaleProvider } from "@/i18n/locale-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LocaleProvider>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </LocaleProvider>
    </ThemeProvider>
  );
}
