import { BUILT_IN_THEMES, ThemeDto } from "@/lib/theme-constants";

export async function getThemes(): Promise<ThemeDto[]> {
  return BUILT_IN_THEMES.map((t, idx) => ({
    id: `builtin-${idx}`,
    slug: t.slug,
    nameAr: t.nameAr,
    nameEn: t.nameEn,
    mode: t.mode as "light" | "dark",
    tokens: t.tokens,
    enabled: t.enabled,
    builtIn: t.builtIn,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }));
}
