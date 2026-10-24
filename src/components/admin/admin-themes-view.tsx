"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { BUILT_IN_THEMES, ThemeDto } from "@/lib/theme-constants";
import { toggleThemeEnabled, saveTheme, resetThemeToDefault } from "@/app/actions/themes";
import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Palette,
  Check,
  X,
  Edit2,
  Eye,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { notify } from "@/lib/toast";

// Dynamic import for react-colorful HexColorPicker
const HexColorPicker = dynamic(
  () => import("react-colorful").then((mod) => mod.HexColorPicker),
  { ssr: false, loading: () => <div className="h-36 w-full animate-pulse rounded-xl bg-muted/40" /> }
);

interface Props {
  initialThemes: ThemeDto[];
}

export function AdminThemesView({ initialThemes }: Props) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [themes, setThemes] = useState<ThemeDto[]>(initialThemes);
  const [editingTheme, setEditingTheme] = useState<ThemeDto | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form states for editing
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [bgToken, setBgToken] = useState("");
  const [fgToken, setFgToken] = useState("");
  const [primaryToken, setPrimaryToken] = useState("");
  const [headingToken, setHeadingToken] = useState("");
  const [secondaryTitleToken, setSecondaryTitleToken] = useState("");

  const handleToggle = (theme: ThemeDto) => {
    if (theme.builtIn && (theme.slug === "light" || theme.slug === "black")) {
      notify.error(isAr ? "لا يمكن تعطيل السمة الافتراضية" : "Cannot disable default theme");
      return;
    }

    startTransition(async () => {
      try {
        const next = !theme.enabled;
        await toggleThemeEnabled(theme.id, next);
        setThemes((prev) =>
          prev.map((t) => (t.id === theme.id ? { ...t, enabled: next } : t))
        );
        notify.success(
          isAr
            ? `تم ${next ? "تفعيل" : "تعطيل"} سمة ${theme.nameAr}`
            : `Theme ${theme.nameEn} ${next ? "enabled" : "disabled"}`
        );
      } catch (err: unknown) {
        notify.error(err instanceof Error ? err.message : "Error");
      }
    });
  };

  const openEditor = (theme: ThemeDto) => {
    setEditingTheme(theme);
    setNameAr(theme.nameAr);
    setNameEn(theme.nameEn);
    setMode(theme.mode);
    setBgToken(theme.tokens["--background"] || "");
    setFgToken(theme.tokens["--foreground"] || "");
    setPrimaryToken(theme.tokens["--primary"] || "");
    setHeadingToken(theme.tokens["--heading"] || "");
    setSecondaryTitleToken(theme.tokens["--title-secondary"] || "");
  };

  const handleResetToDefault = (slug: string) => {
    startTransition(async () => {
      try {
        const res = await resetThemeToDefault(slug);
        if (res.success && res.theme) {
          notify.success(isAr ? "تمت استعادة الإعدادات الافتراضية للسمة" : "Theme reset to default successfully");
          const defaultTheme = BUILT_IN_THEMES.find((b) => b.slug === slug);
          if (defaultTheme && editingTheme?.slug === slug) {
            setNameAr(defaultTheme.nameAr);
            setNameEn(defaultTheme.nameEn);
            setMode(defaultTheme.mode as "light" | "dark");
            setBgToken(defaultTheme.tokens["--background"] || "");
            setFgToken(defaultTheme.tokens["--foreground"] || "");
            setPrimaryToken(defaultTheme.tokens["--primary"] || "");
            setHeadingToken(defaultTheme.tokens["--heading"] || "");
            setSecondaryTitleToken(defaultTheme.tokens["--title-secondary"] || "");
          }
          setThemes((prev) =>
            prev.map((t) =>
              t.slug === slug
                ? {
                    ...t,
                    nameAr: res.theme.nameAr,
                    nameEn: res.theme.nameEn,
                    mode: res.theme.mode as "light" | "dark",
                    tokens: (res.theme.tokens as Record<string, string>) || {},
                  }
                : t
            )
          );
        }
      } catch (err: unknown) {
        notify.error(err instanceof Error ? err.message : "Failed to reset theme");
      }
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTheme) return;
    if (!nameAr.trim() || !nameEn.trim()) {
      notify.error(isAr ? "يرجى إدخال اسم السمة بالعربية والإنجليزية" : "Please enter theme names");
      return;
    }

    startTransition(async () => {
      try {
        const tokens: Record<string, string> = {
          ...editingTheme.tokens,
          "--background": bgToken,
          "--foreground": fgToken,
          "--primary": primaryToken,
          "--heading": headingToken,
          "--title-secondary": secondaryTitleToken,
        };

        const res = await saveTheme({
          id: editingTheme.id,
          slug: editingTheme.slug,
          nameAr,
          nameEn,
          mode,
          tokens,
        });

        if (res.success && res.theme) {
          notify.success(isAr ? "تم حفظ السمة بنجاح" : "Theme saved successfully");
          setEditingTheme(null);
          // Refresh list locally
          setThemes((prev) =>
            prev.map((t) =>
              t.slug === editingTheme.slug
                ? {
                    ...t,
                    nameAr: res.theme.nameAr,
                    nameEn: res.theme.nameEn,
                    mode: res.theme.mode as "light" | "dark",
                    tokens: (res.theme.tokens as Record<string, string>) || {},
                    updatedAt: res.theme.updatedAt.toISOString(),
                  }
                : t
            )
          );
        }
      } catch (err: unknown) {
        notify.error(err instanceof Error ? err.message : "Error saving theme");
      }
    });
  };

  return (
    <div className="space-y-8 p-6 lg:p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-2">
            <Palette className="size-3.5" />
            <span>{isAr ? "إدارة وتخصيص السمات" : "Theme Studio & Management"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
            {isAr ? "السمات والمظهر البصري" : "Themes & Visual System"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            {isAr
              ? "تحكم في السمات الأربع الرسمية للمنصة (فاتح، غروب، أموليد، أسود)، وتخصيص رموز الألوان بنظام التباين الصارم."
              : "Control the four official platform themes (Light, Sunset, Amoled, Black), and configure color tokens with strict AA contrast."}
          </p>
        </div>
      </div>

      {/* Themes Table / Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {themes.map((theme) => {
          return (
            <div
              key={theme.id}
              data-testid={`admin-theme-card-${theme.slug}`}
              className={`rounded-2xl border bg-card/60 backdrop-blur-xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm ${
                theme.enabled
                  ? "border-border/80 hover:border-primary/50"
                  : "border-border/40 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-base text-foreground">
                      {isAr ? theme.nameAr : theme.nameEn}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border/50">
                      {isAr ? "أساسية" : "Built-in"}
                    </span>
                  </div>
                  <span
                    className={`size-2.5 rounded-full ${
                      theme.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                </div>

                <div className="text-xs text-muted-foreground mb-4 font-mono">
                  slug: {theme.slug} · mode: {theme.mode}
                </div>

                {/* Swatches preview */}
                <div className="p-3 rounded-xl border border-border/50 bg-background/50 mb-4 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{isAr ? "معاينة العناوين" : "Heading Preview"}</span>
                    <Sparkles className="size-3 text-primary" />
                  </div>
                  <div
                    className="p-2 rounded-lg text-xs font-bold font-heading truncate"
                    style={{
                      backgroundColor: theme.tokens["--background"] || "#fff",
                      color: theme.tokens["--heading"] || "#000",
                    }}
                  >
                    {isAr ? theme.nameAr : theme.nameEn} Title
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border/40 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditor(theme)}
                  className="rounded-lg h-8 px-2.5 text-xs gap-1.5"
                >
                  <Edit2 className="size-3.5" />
                  <span>{isAr ? "تعديل" : "Edit"}</span>
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleResetToDefault(theme.slug)}
                    title={isAr ? "استعادة الإعدادات الأصلية" : "Reset to default"}
                    className="rounded-lg h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" />
                  </Button>

                  <Button
                    variant={theme.enabled ? "outline" : "default"}
                    size="sm"
                    disabled={isPending || (theme.builtIn && ["light", "black"].includes(theme.slug))}
                    onClick={() => handleToggle(theme)}
                    className="rounded-lg h-8 px-2.5 text-xs gap-1"
                  >
                    {theme.enabled ? (
                      <>
                        <X className="size-3 text-destructive" />
                        <span>{isAr ? "تعطيل" : "Disable"}</span>
                      </>
                    ) : (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span>{isAr ? "تفعيل" : "Enable"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal or Panel */}
      {editingTheme && (
        <div className="p-6 sm:p-8 rounded-3xl border border-primary/30 bg-card/90 backdrop-blur-2xl shadow-2xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-heading font-bold text-foreground flex items-center gap-2">
              <Palette className="size-5 text-primary" />
              <span>
                {isAr
                  ? `تعديل سمة: ${editingTheme.nameAr}`
                  : `Edit Theme: ${editingTheme.nameEn}`}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleResetToDefault(editingTheme.slug)}
                className="rounded-xl text-xs gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                <span>{isAr ? "استعادة الافتراضي" : "Reset to Default"}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingTheme(null)}
                className="rounded-full size-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold">{isAr ? "المعرف (Slug)" : "Slug"}</Label>
                <Input
                  value={editingTheme.slug}
                  disabled
                  className="mt-1 font-mono text-sm bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">{isAr ? "الاسم بالعربية" : "Arabic Name"}</Label>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: فاتح"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">{isAr ? "الاسم بالإنجليزية" : "English Name"}</Label>
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Light"
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold">{isAr ? "نوع النمط" : "Theme Mode"}</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={mode === "light" ? "default" : "outline"}
                    onClick={() => setMode("light")}
                    className="flex-1 rounded-xl h-10 text-xs"
                  >
                    {isAr ? "فاتح (Light)" : "Light Mode"}
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "dark" ? "default" : "outline"}
                    onClick={() => setMode("dark")}
                    className="flex-1 rounded-xl h-10 text-xs"
                  >
                    {isAr ? "داكن (Dark)" : "Dark Mode"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Tokens Configuration */}
            <div className="pt-4 border-t border-border/50">
              <h3 className="text-sm font-heading font-bold text-foreground mb-4">
                {isAr ? "رموز الألوان الأساسية (CSS Variables)" : "Core CSS Color Tokens"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                <div className="space-y-2 rounded-xl border border-border/40 p-3 bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">--background</Label>
                    <span className="size-4 rounded-full border border-border shadow-xs" style={{ backgroundColor: bgToken }} />
                  </div>
                  <Input
                    value={bgToken}
                    onChange={(e) => setBgToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="pt-2 flex justify-center">
                    <HexColorPicker
                      color={bgToken.startsWith("#") ? bgToken : "#ffffff"}
                      onChange={setBgToken}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/40 p-3 bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">--foreground</Label>
                    <span className="size-4 rounded-full border border-border shadow-xs" style={{ backgroundColor: fgToken }} />
                  </div>
                  <Input
                    value={fgToken}
                    onChange={(e) => setFgToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="pt-2 flex justify-center">
                    <HexColorPicker
                      color={fgToken.startsWith("#") ? fgToken : "#111111"}
                      onChange={setFgToken}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/40 p-3 bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">--primary</Label>
                    <span className="size-4 rounded-full border border-border shadow-xs" style={{ backgroundColor: primaryToken }} />
                  </div>
                  <Input
                    value={primaryToken}
                    onChange={(e) => setPrimaryToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="pt-2 flex justify-center">
                    <HexColorPicker
                      color={primaryToken.startsWith("#") ? primaryToken : "#166534"}
                      onChange={setPrimaryToken}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/40 p-3 bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">--heading (العناوين الرئيسية)</Label>
                    <span className="size-4 rounded-full border border-border shadow-xs" style={{ backgroundColor: headingToken }} />
                  </div>
                  <Input
                    value={headingToken}
                    onChange={(e) => setHeadingToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="pt-2 flex justify-center">
                    <HexColorPicker
                      color={headingToken.startsWith("#") ? headingToken : "#15803d"}
                      onChange={setHeadingToken}
                    />
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-border/40 p-3 bg-card/40">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">--title-secondary (العناوين الفرعية)</Label>
                    <span className="size-4 rounded-full border border-border shadow-xs" style={{ backgroundColor: secondaryTitleToken }} />
                  </div>
                  <Input
                    value={secondaryTitleToken}
                    onChange={(e) => setSecondaryTitleToken(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="pt-2 flex justify-center">
                    <HexColorPicker
                      color={secondaryTitleToken.startsWith("#") ? secondaryTitleToken : "#d97706"}
                      onChange={setSecondaryTitleToken}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Preview Box */}
            <div
              className="p-5 rounded-2xl border transition-all duration-300 space-y-3"
              style={{
                backgroundColor: bgToken || "#fff",
                color: fgToken || "#000",
                borderColor: primaryToken || "#ccc",
              }}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{isAr ? "معاينة مباشرة للسمة" : "Live Theme Preview"}</span>
                <Eye className="size-4" />
              </div>
              <h4
                className="text-lg font-heading font-bold"
                style={{ color: headingToken || fgToken }}
              >
                {isAr ? nameAr || "عنوان تجريبي للسمة" : nameEn || "Theme Heading Sample"}
              </h4>
              <p
                className="text-sm font-semibold"
                style={{ color: secondaryTitleToken || primaryToken }}
              >
                {isAr ? "عنوان فرعي تكميلي يبرز التناسق البصري" : "Secondary Subtitle Accent Line"}
              </p>
              <p className="text-xs opacity-80 leading-relaxed max-w-lg">
                {isAr
                  ? "هذا النص يوضح تناسق الخط والتباين البصري وفق معايير WCAG AA."
                  : "This preview verifies typography alignment and color contrast according to WCAG AA guidelines."}
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingTheme(null)}
                className="rounded-xl"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl font-heading font-semibold px-6"
              >
                {isPending ? (isAr ? "جاري الحفظ..." : "Saving...") : isAr ? "حفظ التغييرات" : "Save Theme"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
