"use client";

import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Loader2, Check, X } from "lucide-react";
import { translateText } from "@/app/actions/translate";

interface BilingualFieldsProps {
  arabicLabel?: string;
  englishLabel?: string;
  arabicName: string;
  englishName: string;
  arabicPlaceholder?: string;
  englishPlaceholder?: string;
  defaultArabic?: string;
  defaultEnglish?: string;
  required?: boolean;
  locale?: string;
}

export function BilingualFields({
  arabicLabel = "Arabic",
  englishLabel = "English",
  arabicName,
  englishName,
  arabicPlaceholder = "",
  englishPlaceholder = "",
  defaultArabic = "",
  defaultEnglish = "",
  required = true,
  locale = "ar",
}: BilingualFieldsProps) {
  const [arValue, setArValue] = useState(defaultArabic);
  const [enValue, setEnValue] = useState(defaultEnglish);

  const [suggestedEn, setSuggestedEn] = useState<string | null>(null);
  const [suggestedAr, setSuggestedAr] = useState<string | null>(null);

  const [loadingEn, setLoadingEn] = useState(false);
  const [loadingAr, setLoadingAr] = useState(false);

  const prevDefaultArRef = useRef(defaultArabic);
  const prevDefaultEnRef = useRef(defaultEnglish);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (defaultArabic !== prevDefaultArRef.current) {
        setArValue(defaultArabic);
        prevDefaultArRef.current = defaultArabic;
        setSuggestedEn(null);
      }
      if (defaultEnglish !== prevDefaultEnRef.current) {
        setEnValue(defaultEnglish);
        prevDefaultEnRef.current = defaultEnglish;
        setSuggestedAr(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [defaultArabic, defaultEnglish]);

  // Debounced translation AR -> EN suggestion
  useEffect(() => {
    const trimmedAr = arValue.trim();
    if (!trimmedAr || trimmedAr.length < 3) {
      const clearTimer = setTimeout(() => {
        setSuggestedEn(null);
        setLoadingEn(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    // Only suggest if English field is empty or user hasn't typed an explicit English value
    if (enValue.trim().length > 0) {
      const clearTimer = setTimeout(() => {
        setSuggestedEn(null);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      setLoadingEn(true);
      const res = await translateText({ text: trimmedAr, from: "ar", to: "en" });
      setLoadingEn(false);
      if (res.success && res.translation) {
        setSuggestedEn(res.translation);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [arValue, enValue]);

  // Debounced translation EN -> AR suggestion
  useEffect(() => {
    const trimmedEn = enValue.trim();
    if (!trimmedEn || trimmedEn.length < 3) {
      const clearTimer = setTimeout(() => {
        setSuggestedAr(null);
        setLoadingAr(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    // Only suggest if Arabic field is empty
    if (arValue.trim().length > 0) {
      const clearTimer = setTimeout(() => {
        setSuggestedAr(null);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      setLoadingAr(true);
      const res = await translateText({ text: trimmedEn, from: "en", to: "ar" });
      setLoadingAr(false);
      if (res.success && res.translation) {
        setSuggestedAr(res.translation);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [enValue, arValue]);

  const acceptSuggestion = (type: "en" | "ar") => {
    if (type === "en" && suggestedEn) {
      setEnValue(suggestedEn);
      setSuggestedEn(null);
    } else if (type === "ar" && suggestedAr) {
      setArValue(suggestedAr);
      setSuggestedAr(null);
    }
  };

  const dismissSuggestion = (type: "en" | "ar") => {
    if (type === "en") setSuggestedEn(null);
    if (type === "ar") setSuggestedAr(null);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Arabic Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            {arabicLabel}
            {required && <span className="text-destructive ms-1">*</span>}
          </label>
          {loadingAr && (
            <span className="flex items-center gap-1 text-[10px] text-brass animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              {locale === "ar" ? "جارِ الترجمة..." : "Translating..."}
            </span>
          )}
        </div>

        <input
          type="text"
          name={arabicName}
          value={arValue}
          onChange={(e) => {
            setArValue(e.target.value);
            if (suggestedAr) setSuggestedAr(null);
          }}
          required={required}
          placeholder={arabicPlaceholder}
          className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass"
        />

        {/* Suggestion Chip for Arabic */}
        {suggestedAr && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brass/10 border border-brass/30 text-xs text-foreground mt-1 max-w-full">
            <Sparkles className="size-3 text-brass shrink-0" />
            <span className="text-[11px] text-muted-foreground shrink-0">
              {locale === "ar" ? "اقتراح:" : "Suggestion:"}
            </span>
            <span className="font-medium truncate max-w-[160px] sm:max-w-[200px]" title={suggestedAr}>
              {suggestedAr}
            </span>
            <button
              type="button"
              onClick={() => acceptSuggestion("ar")}
              className="p-0.5 rounded hover:bg-brass/20 text-brass focus:outline-none ms-1 transition-colors"
              title={locale === "ar" ? "قبول" : "Accept"}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => dismissSuggestion("ar")}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground focus:outline-none transition-colors"
              title={locale === "ar" ? "تجاهل" : "Dismiss"}
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* English Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            {englishLabel}
            {required && <span className="text-destructive ms-1">*</span>}
          </label>
          {loadingEn && (
            <span className="flex items-center gap-1 text-[10px] text-brass animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              {locale === "ar" ? "جارِ الترجمة..." : "Translating..."}
            </span>
          )}
        </div>

        <input
          type="text"
          name={englishName}
          value={enValue}
          onChange={(e) => {
            setEnValue(e.target.value);
            if (suggestedEn) setSuggestedEn(null);
          }}
          required={required}
          placeholder={englishPlaceholder}
          className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brass dir-ltr"
        />

        {/* Suggestion Chip for English */}
        {suggestedEn && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brass/10 border border-brass/30 text-xs text-foreground mt-1 max-w-full dir-ltr">
            <Sparkles className="size-3 text-brass shrink-0" />
            <span className="text-[11px] text-muted-foreground shrink-0">Suggestion:</span>
            <span className="font-medium truncate max-w-[160px] sm:max-w-[200px]" title={suggestedEn}>
              {suggestedEn}
            </span>
            <button
              type="button"
              onClick={() => acceptSuggestion("en")}
              className="p-0.5 rounded hover:bg-brass/20 text-brass focus:outline-none ms-1 transition-colors"
              title="Accept"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => dismissSuggestion("en")}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground focus:outline-none transition-colors"
              title="Dismiss"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
