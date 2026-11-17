import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { safeRevalidatePath } from "@/lib/cache";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { getCachedEnabledThemes } from "@/lib/theme-server";
import { isSafeLocalAssetPath, verifyUploadProof } from "@/lib/upload-security";

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
    const { theme, locale, reduceMotion, coverImage, uploadProof } = body;

    const data: {
      theme?: string;
      locale?: string;
      reduceMotion?: boolean;
      coverImage?: string | null;
      coverImagePublicId?: string | null;
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

    let previousCoverPublicIdToDelete: string | null = null;

    if (typeof uploadProof === "string" && uploadProof.trim()) {
      const verified = verifyUploadProof(uploadProof.trim(), session.user.id, "covers");
      if (!verified) {
        return NextResponse.json({ error: "Invalid cover upload proof" }, { status: 400 });
      }
      const existingUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { coverImagePublicId: true },
      });
      if (
        existingUser?.coverImagePublicId &&
        existingUser.coverImagePublicId.startsWith("ihyaa-covers/") &&
        existingUser.coverImagePublicId !== verified.publicId
      ) {
        previousCoverPublicIdToDelete = existingUser.coverImagePublicId;
      }
      data.coverImage = verified.url;
      data.coverImagePublicId = verified.publicId;
      data.coverWidth = verified.imageWidth;
      data.coverHeight = verified.imageHeight;
    } else if (coverImage !== undefined) {
      if (coverImage === null) {
        const existingUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { coverImagePublicId: true },
        });
        if (existingUser?.coverImagePublicId?.startsWith("ihyaa-covers/")) {
          previousCoverPublicIdToDelete = existingUser.coverImagePublicId;
        }
        data.coverImage = null;
        data.coverImagePublicId = null;
        data.coverWidth = null;
        data.coverHeight = null;
      } else if (typeof coverImage === "string" && isSafeLocalAssetPath(coverImage)) {
        const existingUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { coverImagePublicId: true },
        });
        if (existingUser?.coverImagePublicId?.startsWith("ihyaa-covers/")) {
          previousCoverPublicIdToDelete = existingUser.coverImagePublicId;
        }
        data.coverImage = coverImage.trim();
        data.coverImagePublicId = null;
        data.coverWidth = null;
        data.coverHeight = null;
      } else {
        return NextResponse.json({ error: "Invalid cover image URL" }, { status: 400 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        theme: true,
        locale: true,
        reduceMotion: true,
        coverImage: true,
        coverWidth: true,
        coverHeight: true,
      },
    });

    if (previousCoverPublicIdToDelete) {
      await deleteImageFromCloudinary(previousCoverPublicIdToDelete).catch(() => {});
    }

    safeRevalidatePath("/profile");
    safeRevalidatePath("/settings");
    safeRevalidatePath(`/u/${session.user.id}`);

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
