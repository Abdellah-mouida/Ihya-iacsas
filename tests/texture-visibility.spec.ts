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
      const textureLayer = page.locator('[data-testid="site-atmosphere"]');
      await expect(textureLayer).toBeAttached();

      // Check SVG pattern element inside
      const svg = textureLayer.locator("svg");
      await expect(svg).toBeAttached();

      // Verify that the central radial dimming overlay has been removed from page-texture
      const radialDimOverlay = textureLayer.locator("div.pointer-events-none.absolute.inset-0");
      await expect(radialDimOverlay).toHaveCount(0);

      // The pattern and the selected theme accent must resolve to the same color token.
      const patternColor = await svg.evaluate((el) => getComputedStyle(el).color);
      const themeAccent = await page.evaluate(() => {
        const span = document.createElement("span");
        span.style.color = "var(--main)";
        document.body.append(span);
        const color = getComputedStyle(span).color;
        span.remove();
        return color;
      });
      expect(patternColor).toBe(themeAccent);
      const patternOpacity = await svg.evaluate((el) => getComputedStyle(el).opacity);
      expect(Number(patternOpacity)).toBeGreaterThan(0);

      // Capture desktop viewport screenshot for visual evidence
      await page.setViewportSize({ width: 1440, height: 900 });
      const evidencePath = path.join(process.cwd(), `evidence/task-1/texture-${theme}-1440.png`);
      await page.screenshot({ path: evidencePath, fullPage: false });
      expect(fs.existsSync(evidencePath)).toBe(true);

      // Isolate the root atmosphere so page content cannot create false contrast.
      await page.evaluate(() => {
        const app = document.querySelector("body > div.relative.z-10") as HTMLElement | null;
        if (app) app.style.display = "none";
      });
      const textureVisible = await page.screenshot();
      await svg.evaluate((el) => ((el as SVGElement).style.visibility = "hidden"));
      const textureHidden = await page.screenshot();
      const visiblePixels = await sharp(textureVisible).raw().toBuffer({ resolveWithObject: true });
      const hiddenPixels = await sharp(textureHidden).raw().toBuffer();

      const luminance = (r: number, g: number, b: number) => {
        const linear = [r, g, b].map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      let pixelsAtOrAboveFloor = 0;
      let maximumContrast = 1;
      for (let i = 0; i < visiblePixels.data.length; i += visiblePixels.info.channels) {
        const visibleLum = luminance(
          visiblePixels.data[i],
          visiblePixels.data[i + 1],
          visiblePixels.data[i + 2],
        );
        const hiddenLum = luminance(hiddenPixels[i], hiddenPixels[i + 1], hiddenPixels[i + 2]);
        const contrast = (Math.max(visibleLum, hiddenLum) + 0.05) / (Math.min(visibleLum, hiddenLum) + 0.05);
        maximumContrast = Math.max(maximumContrast, contrast);
        if (contrast >= 1.05) pixelsAtOrAboveFloor++;
      }
      expect(
        maximumContrast,
        `${theme}: visible pattern pixels must reach at least 1.05:1 against the same atmosphere without the SVG`,
      ).toBeGreaterThanOrEqual(1.05);
      expect(pixelsAtOrAboveFloor, `${theme}: texture must occupy more than isolated pixels`).toBeGreaterThan(100);
    });
  }
});
