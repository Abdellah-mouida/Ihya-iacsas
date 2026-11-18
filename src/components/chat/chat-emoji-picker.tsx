"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type RawEmojiTuple = [
  unicode: string,
  group: number,
  enLabel: string,
  enTags: string,
  arText: string,
  skins?: string[],
];

interface ParsedEmoji {
  unicode: string;
  group: number;
  searchEn: string;
  searchAr: string;
  label: string;
  skins?: string[];
}

const RECENT_STORAGE_KEY = "ihyaa_recent_emojis";
const TONE_STORAGE_KEY = "ihyaa_emoji_tone";
const MAX_RECENT = 12;

const CATEGORY_TABS = [
  { id: 0, icon: "😊", labelKey: "chat.emojiCatSmileys" },
  { id: 1, icon: "🐾", labelKey: "chat.emojiCatAnimals" },
  { id: 2, icon: "🍎", labelKey: "chat.emojiCatFood" },
  { id: 3, icon: "⚽", labelKey: "chat.emojiCatActivities" },
  { id: 4, icon: "🕌", labelKey: "chat.emojiCatTravel" },
  { id: 5, icon: "💡", labelKey: "chat.emojiCatObjects" },
  { id: 6, icon: "💠", labelKey: "chat.emojiCatSymbols" },
  { id: 7, icon: "🇲🇦", labelKey: "chat.emojiCatFlags" },
] as const;

const SKIN_TONE_SAMPLES = ["👋", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"] as const;

function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

let cachedCatalog: ParsedEmoji[] | null = null;
const supportedGlyphCache = new Map<string, boolean>();
let canvasCtx: CanvasRenderingContext2D | null | undefined;
let tofuSignature: string | null = null;
let singleEmojiWidth = 0;

function ensureCanvasSupportContext() {
  if (canvasCtx !== undefined) return canvasCtx;
  if (typeof document === "undefined") {
    canvasCtx = null;
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 24;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    canvasCtx = null;
    return null;
  }
  ctx.textBaseline = "top";
  ctx.font = '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  singleEmojiWidth = ctx.measureText("😀").width || 20;

  ctx.clearRect(0, 0, 32, 24);
  ctx.fillText("\uFFFF", 2, 2);
  tofuSignature = signatureFromImageData(ctx.getImageData(0, 0, 32, 24).data);
  canvasCtx = ctx;
  return ctx;
}

function signatureFromImageData(data: Uint8ClampedArray): string {
  let nonZero = 0;
  let hash = 2166136261;
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i];
    if (a > 0) nonZero += 1;
    hash = Math.imul(hash ^ a, 16777619);
  }
  return `${nonZero}:${hash >>> 0}`;
}

function isEmojiSupported(unicode: string): boolean {
  const cached = supportedGlyphCache.get(unicode);
  if (cached !== undefined) return cached;

  const ctx = ensureCanvasSupportContext();
  if (!ctx) {
    supportedGlyphCache.set(unicode, true);
    return true;
  }

  const measuredWidth = ctx.measureText(unicode).width;
  if (measuredWidth <= 0) {
    supportedGlyphCache.set(unicode, false);
    return false;
  }
  if (singleEmojiWidth > 0 && measuredWidth > singleEmojiWidth * 1.65) {
    supportedGlyphCache.set(unicode, false);
    return false;
  }

  ctx.clearRect(0, 0, 32, 24);
  ctx.fillText(unicode, 2, 2);
  const sig = signatureFromImageData(ctx.getImageData(0, 0, 32, 24).data);
  const hasInk = !sig.startsWith("0:");
  const ok = hasInk && sig !== tofuSignature;
  supportedGlyphCache.set(unicode, ok);
  return ok;
}

function readRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

function writeRecentEmoji(emoji: string): string[] {
  const prev = readRecentEmojis();
  const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage unavailability
  }
  return next;
}

function readSavedTone(): number {
  try {
    const val = Number(localStorage.getItem(TONE_STORAGE_KEY) || "0");
    return Number.isInteger(val) && val >= 0 && val <= 5 ? val : 0;
  } catch {
    return 0;
  }
}

export function ChatEmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const [catalog, setCatalog] = useState<ParsedEmoji[] | null>(cachedCatalog);
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [tone, setTone] = useState<number>(() => readSavedTone());
  const [recent, setRecent] = useState<string[]>(() => readRecentEmojis());

  useEffect(() => {
    if (cachedCatalog) return;
    let active = true;
    void import("@/lib/chat/emoji-catalog.json").then((mod) => {
      const tuples = (mod.default ?? mod) as RawEmojiTuple[];
      const parsed: ParsedEmoji[] = [];
      for (const row of tuples) {
        const [unicode, group, enLabel, enTags, arText, skins] = row;
        if (!isEmojiSupported(unicode)) continue;
        parsed.push({
          unicode,
          group,
          label: enLabel || unicode,
          searchEn: `${enLabel} ${enTags}`.toLowerCase(),
          searchAr: normalizeArabic(arText),
          skins,
        });
      }
      cachedCatalog = parsed;
      if (active) {
        setCatalog(parsed);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const query = search.trim();
  const isSearching = query.length > 0;
  const queryEn = query.toLowerCase();
  const queryAr = normalizeArabic(query);

  const visibleItems = useMemo(() => {
    if (!catalog) return [];
    if (isSearching) {
      const matched: ParsedEmoji[] = [];
      for (const item of catalog) {
        if (item.searchEn.includes(queryEn) || item.searchAr.includes(queryAr)) {
          matched.push(item);
          if (matched.length >= 240) break;
        }
      }
      return matched;
    }
    return catalog.filter((item) => item.group === activeCategory);
  }, [activeCategory, catalog, isSearching, queryAr, queryEn]);

  const resolveDisplayEmoji = (item: ParsedEmoji) => {
    if (tone > 0 && item.skins && item.skins[tone - 1]) {
      return item.skins[tone - 1];
    }
    return item.unicode;
  };

  const handlePick = (emoji: string) => {
    const nextRecent = writeRecentEmoji(emoji);
    setRecent(nextRecent);
    onSelect(emoji);
  };

  const handleToneChange = (nextTone: number) => {
    setTone(nextTone);
    try {
      localStorage.setItem(TONE_STORAGE_KEY, String(nextTone));
    } catch {
      // Ignore storage unavailability
    }
  };

  return (
    <div
      data-testid="chat-emoji-picker"
      role="dialog"
      aria-label={t("chat.emojiPickerLabel")}
      className={cn(
        "mt-2 flex w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-layered",
        "md:absolute md:bottom-full md:start-3 md:mt-0 md:mb-2 md:w-[348px]",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2.5 py-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            data-testid="chat-emoji-search"
            dir="auto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("chat.emojiSearchPlaceholder")}
            className="h-11 w-full rounded-xl border border-border/70 bg-background/80 ps-8 pe-2.5 text-base text-foreground placeholder:text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring md:h-9 md:text-xs"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground md:size-9"
        >
          <X className="size-4" />
        </button>
      </div>

      <div
        role="tablist"
        aria-label={t("chat.emojiPickerLabel")}
        className="flex items-center justify-between gap-0.5 overflow-x-auto border-b border-border/60 px-1.5 py-1"
      >
        {CATEGORY_TABS.map((cat) => {
          const active = !isSearching && activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`emoji-cat-${cat.id}`}
              aria-label={t(cat.labelKey)}
              title={t(cat.labelKey)}
              onClick={() => {
                setSearch("");
                setActiveCategory(cat.id);
              }}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl text-base transition-colors md:size-9",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/35"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              <span aria-hidden="true">{cat.icon}</span>
            </button>
          );
        })}
      </div>

      <div className="max-h-36 min-h-32 overflow-y-auto px-2 py-2 sm:max-h-56">
        {!catalog ? (
          <div className="grid grid-cols-7 gap-1 py-2">
            {Array.from({ length: 21 }).map((_, idx) => (
              <div
                key={idx}
                className="size-11 animate-pulse rounded-xl bg-muted/45 md:size-10"
              />
            ))}
          </div>
        ) : (
          <>
            {!isSearching && activeCategory === 0 && recent.length > 0 ? (
              <div className="mb-2">
                <p className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">
                  {t("chat.emojiRecent")}
                </p>
                <div className="grid grid-cols-7 gap-0.5">
                  {recent.map((em) => (
                    <button
                      key={`recent-${em}`}
                      type="button"
                      onClick={() => handlePick(em)}
                      className="grid size-11 place-items-center rounded-xl text-xl hover:bg-primary/15 md:size-10"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!isSearching ? (
              <p className="mb-1 px-1 text-[11px] font-semibold text-muted-foreground">
                {t(CATEGORY_TABS[activeCategory].labelKey)}
              </p>
            ) : null}

            {visibleItems.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {t("chat.emojiNoResults")}
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-0.5">
                {visibleItems.map((item) => {
                  const glyph = resolveDisplayEmoji(item);
                  const ariaLabel =
                    locale === "ar" && item.searchAr ? item.searchAr : item.label;
                  return (
                    <button
                      key={item.unicode}
                      type="button"
                      aria-label={ariaLabel}
                      onClick={() => handlePick(glyph)}
                      className="grid size-11 place-items-center rounded-xl text-xl hover:bg-primary/15 md:size-10"
                    >
                      {glyph}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-background/40 px-2.5 py-1.5">
        <span className="text-[11px] text-muted-foreground">
          {t("chat.emojiSkinToneLabel")}
        </span>
        <div className="flex items-center gap-0.5">
          {SKIN_TONE_SAMPLES.map((sample, idx) => (
            <button
              key={sample}
              type="button"
              data-testid={`emoji-tone-${idx}`}
              aria-pressed={tone === idx}
              onClick={() => handleToneChange(idx)}
              className={cn(
                "grid size-11 place-items-center rounded-xl text-base transition-colors md:size-8",
                tone === idx
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : "hover:bg-muted/60",
              )}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
