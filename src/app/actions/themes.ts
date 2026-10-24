"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeRevalidatePath, safeRevalidateTag } from "@/lib/cache";
import { BUILT_IN_THEMES, ThemeDto } from "@/lib/theme-constants";
import { Prisma } from "@prisma/client";

async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function getThemes(): Promise<ThemeDto[]> {
  try {
    // Seed built-ins if empty
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
            tokens: t.tokens as unknown as Prisma.InputJsonValue,
            enabled: t.enabled,
            builtIn: t.builtIn,
          },
        });
      }
    }

    const themes = await prisma.theme.findMany({
      orderBy: [{ builtIn: "desc" }, { createdAt: "asc" }],
    });

    return themes.map((t: {
      id: string;
      slug: string;
      nameAr: string;
      nameEn: string;
      mode: string;
      tokens: Prisma.JsonValue;
      enabled: boolean;
      builtIn: boolean;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
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
  } catch (error) {
    console.error("Error fetching themes:", error);
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
}

export async function toggleThemeEnabled(themeId: string, enabled: boolean) {
  await assertAdmin();

  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) throw new Error("NOT_FOUND");
  if (theme.builtIn && !enabled && ["light", "black"].includes(theme.slug)) {
    throw new Error("CANNOT_DISABLE_DEFAULT_THEME");
  }

  const updated = await prisma.theme.update({
    where: { id: themeId },
    data: { enabled },
  });

  safeRevalidatePath("/admin/themes");
  safeRevalidatePath("/settings");
  safeRevalidateTag("themes");
  return { success: true, enabled: updated.enabled };
}

export async function saveTheme(data: {
  id?: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
  enabled?: boolean;
}) {
  await assertAdmin();

  const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if (!slug) throw new Error("INVALID_SLUG");

  const builtInMatch = BUILT_IN_THEMES.find((b) => b.slug === slug);
  if (!builtInMatch) {
    throw new Error("CUSTOM_THEMES_DISABLED: Only built-in themes (light, sunset, amoled, black) can be edited.");
  }

  if (data.id) {
    const existing = await prisma.theme.findUnique({ where: { id: data.id } });
    if (!existing) throw new Error("NOT_FOUND");

    const updated = await prisma.theme.update({
      where: { id: data.id },
      data: {
        nameAr: data.nameAr.trim(),
        nameEn: data.nameEn.trim(),
        mode: data.mode,
        tokens: data.tokens as unknown as Prisma.InputJsonValue,
        enabled: data.enabled ?? existing.enabled,
      },
    });

    safeRevalidatePath("/admin/themes");
    safeRevalidatePath("/settings");
    safeRevalidateTag("themes");
    return { success: true, theme: updated };
  } else {
    // If saving an unpersisted built-in theme
    const upserted = await prisma.theme.upsert({
      where: { slug },
      update: {
        nameAr: data.nameAr.trim(),
        nameEn: data.nameEn.trim(),
        mode: data.mode,
        tokens: data.tokens as unknown as Prisma.InputJsonValue,
        enabled: data.enabled ?? true,
      },
      create: {
        slug,
        nameAr: data.nameAr.trim(),
        nameEn: data.nameEn.trim(),
        mode: data.mode,
        tokens: data.tokens as unknown as Prisma.InputJsonValue,
        enabled: data.enabled ?? true,
        builtIn: true,
      },
    });

    safeRevalidatePath("/admin/themes");
    safeRevalidatePath("/settings");
    safeRevalidateTag("themes");
    return { success: true, theme: upserted };
  }
}

export async function resetThemeToDefault(slug: string) {
  await assertAdmin();

  const defaultTheme = BUILT_IN_THEMES.find((b) => b.slug === slug);
  if (!defaultTheme) {
    throw new Error("INVALID_THEME_SLUG");
  }

  const updated = await prisma.theme.upsert({
    where: { slug: defaultTheme.slug },
    update: {
      nameAr: defaultTheme.nameAr,
      nameEn: defaultTheme.nameEn,
      mode: defaultTheme.mode,
      tokens: defaultTheme.tokens as unknown as Prisma.InputJsonValue,
      enabled: defaultTheme.enabled,
      builtIn: true,
    },
    create: {
      slug: defaultTheme.slug,
      nameAr: defaultTheme.nameAr,
      nameEn: defaultTheme.nameEn,
      mode: defaultTheme.mode,
      tokens: defaultTheme.tokens as unknown as Prisma.InputJsonValue,
      enabled: defaultTheme.enabled,
      builtIn: true,
    },
  });

  safeRevalidatePath("/admin/themes");
  safeRevalidatePath("/settings");
  safeRevalidateTag("themes");
  return { success: true, theme: updated };
}
