export interface ThemeDto {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  mode: "light" | "dark";
  tokens: Record<string, string>;
  enabled: boolean;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export const BUILT_IN_THEMES = [
  {
    slug: "light",
    nameAr: "فاتح",
    nameEn: "Light",
    mode: "light",
    tokens: {
      "--background": "oklch(0.985 0.01 85)",
      "--foreground": "oklch(0.24 0.02 66)",
      "--primary": "oklch(0.48 0.1 168)",
      "--heading": "oklch(0.24 0.02 66)",
      "--title-secondary": "oklch(0.44 0.13 146)",
      "--gold": "oklch(0.8 0.13 84)",
    },
    enabled: true,
    builtIn: true,
  },
  {
    slug: "sunset",
    nameAr: "غروب",
    nameEn: "Sunset",
    mode: "light",
    tokens: {
      "--background": "oklch(0.975 0.02 55)",
      "--foreground": "oklch(0.25 0.035 45)",
      "--primary": "oklch(0.55 0.15 48)",
      "--heading": "oklch(0.28 0.05 45)",
      "--title-secondary": "oklch(0.55 0.15 48)",
      "--gold": "oklch(0.78 0.14 75)",
    },
    enabled: true,
    builtIn: true,
  },
  {
    slug: "amoled",
    nameAr: "Amoled",
    nameEn: "Amoled",
    mode: "dark",
    tokens: {
      "--background": "oklch(0 0 0)",
      "--foreground": "oklch(0.96 0.01 85)",
      "--primary": "oklch(0.72 0.17 148)",
      "--heading": "oklch(0.76 0.18 147)",
      "--title-secondary": "oklch(0.86 0.14 85)",
      "--gold": "oklch(0.86 0.14 85)",
    },
    enabled: true,
    builtIn: true,
  },
  {
    slug: "black",
    nameAr: "أسود",
    nameEn: "Black",
    mode: "dark",
    tokens: {
      "--background": "oklch(0.12 0.005 260)",
      "--foreground": "oklch(0.95 0.01 85)",
      "--primary": "oklch(0.84 0.14 84)",
      "--heading": "oklch(0.86 0.14 85)",
      "--title-secondary": "oklch(0.68 0.15 147)",
      "--gold": "oklch(0.86 0.14 85)",
    },
    enabled: true,
    builtIn: true,
  },
];
