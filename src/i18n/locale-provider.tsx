"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Direction } from "radix-ui";

import ar from "../../locales/ar.json";
import en from "../../locales/en.json";

export type Locale = "ar" | "en";
export type Dir = "rtl" | "ltr";
type Messages = typeof ar;

const dictionaries: Record<Locale, Messages> = {
  ar,
  en: en as Messages,
};

type LocaleContextValue = {
  locale: Locale;
  dir: Dir;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "ihyaa-locale";

function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Always start at the server-rendered default (Arabic) to avoid hydration
  // mismatch; a stored preference is applied after mount.
  const [locale, setLocaleState] = useState<Locale>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "en") {
      setLocaleState(stored);
    }
  }, []);

  const dir: Dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const el = document.documentElement;
    el.lang = locale;
    el.dir = dir;
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale, dir]);

  const setLocale = useCallback((next: Locale) => setLocaleState(next), []);
  const toggleLocale = useCallback(
    () => setLocaleState((prev) => (prev === "ar" ? "en" : "ar")),
    [],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw =
        resolvePath(dictionaries[locale], key) ??
        resolvePath(dictionaries.ar, key);
      if (typeof raw !== "string") return key;
      let result = raw;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return result;
    },
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir, setLocale, toggleLocale, t }),
    [locale, dir, setLocale, toggleLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>
      <Direction.DirectionProvider dir={dir}>
        {children}
      </Direction.DirectionProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
