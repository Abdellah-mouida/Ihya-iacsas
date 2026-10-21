import { prisma } from "@/lib/prisma";
import { BUILT_IN_THEMES, ThemeDto } from "@/lib/theme-constants";
import { unstable_cache } from "next/cache";

/**
 * Cached fetcher for all enabled themes from DB.
 * Uses unstable_cache with tag "themes" for instant revalidation.
 */
export const getCachedEnabledThemes = unstable_cache(
  async (): Promise<ThemeDto[]> => {
    try {
      // Ensure built-in themes exist in database
      const count = await prisma.theme.count();
      if (count === 0) {
        for (const t of BUILT_IN_THEMES) {
          await prisma.theme.upsert({
            where: { slug: t.slug },
            update: {},
            create: {
              slug: t.slug,
              nameAr: t.nameAr,
              nameEn: t.nameEn,
              mode: t.mode,
              tokens: t.tokens as any,
              enabled: t.enabled,
              builtIn: t.builtIn,
            },
          });
        }
      }

      const themes = await prisma.theme.findMany({
        where: { enabled: true },
        orderBy: [{ builtIn: "desc" }, { createdAt: "asc" }],
      });

      return themes.map((t) => ({
        id: t.id,
        slug: t.slug,
        nameAr: t.nameAr,
        nameEn: t.nameEn,
        mode: (t.mode === "dark" ? "dark" : "light") as "light" | "dark",
        tokens: (t.tokens as Record<string, string>) || {},
        enabled: t.enabled,
        builtIn: t.builtIn,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));
    } catch (e) {
      console.error("Failed to load cached themes:", e);
      return BUILT_IN_THEMES.map((t, idx) => ({
        id: `builtin-${idx}`,
        slug: t.slug,
        nameAr: t.nameAr,
        nameEn: t.nameEn,
        mode: t.mode as "light" | "dark",
        tokens: t.tokens,
        enabled: t.enabled,
        builtIn: t.builtIn,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }
  },
  ["enabled-themes"],
  {
    tags: ["themes"],
    revalidate: 3600, // 1 hour fallback
  }
);
