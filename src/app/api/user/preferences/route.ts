import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCachedEnabledThemes } from "@/lib/theme-server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      theme: true,
      locale: true,
      reduceMotion: true,
      coverImage: true,
      coverBlurDataUrl: true,
      coverWidth: true,
      coverHeight: true,
    },
  });

  return NextResponse.json({ preferences: user });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { theme, locale, reduceMotion, coverImage, coverImagePublicId, coverBlurDataUrl, coverWidth, coverHeight } = body;

    const data: {
      theme?: string;
      locale?: string;
      reduceMotion?: boolean;
      coverImage?: string | null;
      coverImagePublicId?: string | null;
      coverBlurDataUrl?: string | null;
      coverWidth?: number | null;
      coverHeight?: number | null;
    } = {};

    // Validate theme against enabled themes in DB
    const enabledThemes = await getCachedEnabledThemes();
    const validThemeSlugs = enabledThemes.map((t) => t.slug);

    if (theme !== undefined && typeof theme === "string" && validThemeSlugs.includes(theme)) {
      data.theme = theme;
    }

    if (locale !== undefined && (locale === "ar" || locale === "en")) {
      data.locale = locale;
    }

    if (reduceMotion !== undefined && typeof reduceMotion === "boolean") {
      data.reduceMotion = reduceMotion;
    }

    if (coverImage !== undefined) {
      data.coverImage = typeof coverImage === "string" ? coverImage : null;
    }

    if (coverImagePublicId !== undefined) {
      data.coverImagePublicId = typeof coverImagePublicId === "string" ? coverImagePublicId : null;
    }

    if (coverBlurDataUrl !== undefined) {
      data.coverBlurDataUrl = typeof coverBlurDataUrl === "string"
        && coverBlurDataUrl.length <= 1024
        && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(coverBlurDataUrl)
        ? coverBlurDataUrl
        : null;
    }
    if (coverWidth !== undefined) data.coverWidth = Number.isInteger(coverWidth) && coverWidth > 0 ? coverWidth : null;
    if (coverHeight !== undefined) data.coverHeight = Number.isInteger(coverHeight) && coverHeight > 0 ? coverHeight : null;

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        theme: true,
        locale: true,
        reduceMotion: true,
        coverImage: true,
        coverBlurDataUrl: true,
        coverWidth: true,
        coverHeight: true,
      },
    });

    const response = NextResponse.json({ success: true, preferences: updated });

    // Sync cookies so server and client stay instantly aligned
    if (data.theme) {
      response.cookies.set("ihyaa-theme", data.theme, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    if (data.locale) {
      response.cookies.set("ihyaa-locale", data.locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    if (data.reduceMotion !== undefined) {
      response.cookies.set("ihyaa-reduce-motion", String(data.reduceMotion), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error("Preferences update failed:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
