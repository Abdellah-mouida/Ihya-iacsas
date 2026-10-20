"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// In-memory module-level storage for the last non-settings path.
// Ceiling: Reset on full page reload (falls back to "/").
// Upgrade path: A validated `?from=` parameter in the query string.
let lastNonSettingsPath: string = "/";

export function RouteHistoryTracker() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>(pathname);

  useEffect(() => {
    if (prevPathRef.current && !prevPathRef.current.startsWith("/settings")) {
      lastNonSettingsPath = prevPathRef.current;
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  return null;
}

export function getLastNonSettingsPath(): string {
  // If the last path happens to be empty or points to /settings, safely fall back to home
  if (!lastNonSettingsPath || lastNonSettingsPath.startsWith("/settings")) {
    return "/";
  }
  return lastNonSettingsPath;
}
