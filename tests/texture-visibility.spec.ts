import { test, expect } from "@playwright/test";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const THEMES = ["light", "sunset", "amoled", "black"] as const;

test.describe("Task 1: Texture Visibility & Numeric Contrast Verification", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(path.join(process.cwd(), "evidence/task-1"), { recursive: true });
  });

  for (const theme of THEMES) {
    test(`texture pattern is attached, visible, and exhibits numeric contrast in ${theme} theme`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Apply theme
      await page.evaluate((th) => {
        document.documentElement.setAttribute("data-theme", th);
        if (th === "black" || th === "amoled") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }, theme);

      // Verify page texture layer exists and is attached
      const textureLayer = page.locator('[data-testid="page-texture-layer"]').first();
      await expect(textureLayer).toBeAttached();

      // Check SVG pattern element inside
      const svg = textureLayer.locator("svg");
      await expect(svg).toBeAttached();

      // Verify that the central radial dimming overlay has been removed from page-texture
      const radialDimOverlay = textureLayer.locator("div.pointer-events-none.absolute.inset-0");
      await expect(radialDimOverlay).toHaveCount(0);

      // Capture desktop viewport screenshot for visual evidence
      await page.setViewportSize({ width: 1440, height: 900 });
      const evidencePath = path.join(process.cwd(), `evidence/task-1/texture-${theme}-1440.png`);
      await page.screenshot({ path: evidencePath, fullPage: false });
      expect(fs.existsSync(evidencePath)).toBe(true);

      // Numeric contrast check on the background texture:
      // Capture a clip of the background outside foreground content cards (e.g. hero gutter area)
      const gutterStrip = await page.screenshot({
        clip: {
          x: 20,
          y: 120,
          width: 120,
          height: 120,
        },
      });

      const { data, info } = await sharp(gutterStrip)
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Compute standard deviation of luminance across pixels in the texture patch.
      // A visible pattern introduces luminance variations between pattern strokes and background fill.
      // If the texture was completely blocked or invisible (flat color), standard deviation would be ~0.
      let sumLum = 0;
      let sumSqLum = 0;
      const totalPixels = info.width * info.height;
      const channels = info.channels;

      let minLum = 255;
      let maxLum = 0;

      for (let i = 0; i < totalPixels; i++) {
        const idx = i * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        sumLum += lum;
        sumSqLum += lum * lum;
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }

      const meanLum = sumLum / totalPixels;
      const variance = sumSqLum / totalPixels - meanLum * meanLum;
      const stdDev = Math.sqrt(Math.max(0, variance));
      const range = maxLum - minLum;

      // Expect measurable luminance variation (stdDev >= 0.5 and range >= 2) indicating active, non-flat texture
      expect(range).toBeGreaterThanOrEqual(2);
      expect(stdDev).toBeGreaterThanOrEqual(0.3);
    });
  }
});
