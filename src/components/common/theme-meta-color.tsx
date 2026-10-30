"use client";

import { useEffect } from "react";

// Canonical background colors for the 4 core themes
const THEME_COLORS: Record<string, string> = {
  light: "#faf8f2",
  sunset: "#faf3ea",
  amoled: "#000000",
  black: "#12101c",
};

export function ThemeMetaColor() {
  useEffect(() => {
    const updateMetaThemeColor = () => {
      const activeTheme =
        document.documentElement.getAttribute("data-theme") ||
        (document.documentElement.classList.contains("dark") ? "black" : "light");

      const color = THEME_COLORS[activeTheme] || (document.documentElement.classList.contains("dark") ? "#12101c" : "#faf8f2");

      let meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", color);

      // Also ensure media-specific theme-color metas don't override the explicit selection
      const mediaMetas = document.querySelectorAll('meta[name="theme-color"][media]');
      mediaMetas.forEach((m) => {
        m.setAttribute("content", color);
      });
    };

    updateMetaThemeColor();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-theme" || mutation.attributeName === "class")
        ) {
          updateMetaThemeColor();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
