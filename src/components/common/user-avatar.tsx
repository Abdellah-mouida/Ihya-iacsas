"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  id?: string | null;
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  shape?: "circle" | "rounded";
  className?: string;
  alt?: string;
  priority?: boolean;
}

const SIZE_MAP = {
  xs: { box: "size-6", text: "text-[10px]", px: 24 },
  sm: { box: "size-8", text: "text-xs", px: 32 },
  md: { box: "size-10", text: "text-sm", px: 40 },
  lg: { box: "size-12", text: "text-base", px: 48 },
  xl: { box: "size-16", text: "text-xl", px: 64 },
  "2xl": { box: "size-24", text: "text-3xl", px: 96 },
  "3xl": { box: "size-28 sm:size-32", text: "text-3xl sm:text-4xl", px: 128 },
};

// Moroccan & Islamic inspired rich gradient palettes (6 deterministic color pairs)
const PALETTES = [
  {
    bg: "from-emerald-700 via-emerald-600 to-teal-500",
    border: "border-emerald-500/30",
    ring: "ring-emerald-500/20",
  },
  {
    bg: "from-amber-700 via-amber-600 to-yellow-500",
    border: "border-amber-500/30",
    ring: "ring-amber-500/20",
  },
  {
    bg: "from-teal-700 via-teal-600 to-cyan-500",
    border: "border-teal-500/30",
    ring: "ring-teal-500/20",
  },
  {
    bg: "from-blue-700 via-indigo-600 to-sky-500",
    border: "border-indigo-500/30",
    ring: "ring-indigo-500/20",
  },
  {
    bg: "from-rose-700 via-rose-600 to-orange-500",
    border: "border-rose-500/30",
    ring: "ring-rose-500/20",
  },
  {
    bg: "from-emerald-800 via-teal-700 to-amber-600",
    border: "border-primary/30",
    ring: "ring-primary/20",
  },
];

/**
 * Deterministically compute a palette index from stable seed (user.id, fallback email or name)
 */
export function getPalette(identifier: string) {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

/**
 * Extract the first letter of the name (Arabic or Latin), falling back to the email's first letter.
 */
export function getInitialLetter(name?: string | null, email?: string | null): string {
  const cleanName = name?.trim();
  if (cleanName) {
    const firstChar = Array.from(cleanName)[0];
    if (firstChar) {
      return firstChar.toUpperCase();
    }
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    const handle = cleanEmail.split("@")[0]?.trim();
    if (handle) {
      const firstChar = Array.from(handle)[0];
      if (firstChar) {
        return firstChar.toUpperCase();
      }
    }
  }

  return "إ"; // Arabic Alif default for Ihyaa
}

// Alias for backwards compatibility with legacy tests
export const getInitials = getInitialLetter;

export function UserAvatar({
  user,
  id: propId,
  src: propSrc,
  name: propName,
  email: propEmail,
  size = "md",
  shape = "circle",
  className,
  alt,
  priority = false,
}: UserAvatarProps) {
  const userId = propId !== undefined ? propId : user?.id;
  const imageSrc = propSrc !== undefined ? propSrc : user?.image;
  const displayName = propName !== undefined ? propName : user?.name;
  const displayEmail = propEmail !== undefined ? propEmail : user?.email;

  const [imageError, setImageError] = useState(false);

  // Reset error state if image src changes
  useEffect(() => {
    setImageError(false);
  }, [imageSrc]);

  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-2xl";

  const initialLetter = useMemo(
    () => getInitialLetter(displayName, displayEmail),
    [displayName, displayEmail]
  );

  // Seed strictly from user.id if available, fallback to email then name
  const seed = userId || displayEmail || displayName || "ihyaa-user";
  const palette = useMemo(() => getPalette(seed), [seed]);

  const hasImage = Boolean(imageSrc) && !imageError;

  return (
    <div
      data-testid="user-avatar"
      data-letter={!hasImage ? initialLetter : undefined}
      data-palette={palette.bg}
      className={cn(
        "relative shrink-0 select-none overflow-hidden flex items-center justify-center border shadow-xs transition-transform",
        sizeConfig.box,
        shapeClass,
        hasImage ? "border-brass/25 ring-1 ring-primary/20 bg-muted/60" : cn(palette.border, "ring-1", palette.ring),
        className,
      )}
    >
      {hasImage ? (
        <Image
          src={imageSrc!}
          alt={alt || displayName || "User avatar"}
          fill
          sizes={`${sizeConfig.px}px`}
          priority={priority}
          unoptimized={imageSrc!.startsWith("data:") || imageSrc!.startsWith("blob:")}
          onError={() => setImageError(true)}
          className={cn("object-cover size-full", shapeClass)}
        />
      ) : (
        <span
          data-testid="letter-avatar-fallback"
          className={cn(
            "size-full flex items-center justify-center font-heading font-bold text-white bg-gradient-to-br tracking-wider",
            palette.bg,
            sizeConfig.text,
            shapeClass,
          )}
        >
          {initialLetter}
        </span>
      )}
    </div>
  );
}
