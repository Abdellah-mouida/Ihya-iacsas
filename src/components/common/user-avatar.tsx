"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
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

// Moroccan & Islamic inspired rich gradient palettes
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
 * Deterministically compute a palette index from user identifier
 */
function getPalette(identifier: string) {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTES.length;
  return PALETTES[index];
}

/**
 * Extract 1-2 initials from name or email (Latin or Arabic)
 */
export function getInitials(name?: string | null, email?: string | null): string {
  const cleanName = name?.trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = Array.from(parts[0])[0];
      const last = Array.from(parts[parts.length - 1])[0];
      return `${first}${last}`.toUpperCase();
    }
    if (parts.length === 1) {
      return Array.from(parts[0])[0].toUpperCase();
    }
  }

  const cleanEmail = email?.trim();
  if (cleanEmail) {
    const handle = cleanEmail.split("@")[0];
    if (handle) {
      return Array.from(handle)[0].toUpperCase();
    }
  }

  return "I";
}

export function UserAvatar({
  user,
  src: propSrc,
  name: propName,
  email: propEmail,
  size = "md",
  shape = "circle",
  className,
  alt,
  priority = false,
}: UserAvatarProps) {
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
  const initials = useMemo(() => getInitials(displayName, displayEmail), [displayName, displayEmail]);
  const palette = useMemo(() => getPalette(displayName || displayEmail || "user"), [displayName, displayEmail]);

  const hasImage = Boolean(imageSrc) && !imageError;

  return (
    <div
      data-testid="user-avatar"
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
          {initials}
        </span>
      )}
    </div>
  );
}
