import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 360, height: 740, name: "mobile" },
  { width: 1440, height: 900, name: "desktop" },
];

const THEMES = ["light", "sunset", "amoled", "black"];

test.describe("Task 5: Hero Photo Visibility & Stacking Contract", () => {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`verifies hero image visibility and layer stacking in ${theme} @ ${vp.name} (${vp.width}x${vp.height})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        // Set active theme
        await page.evaluate((t) => {
          document.documentElement.classList.remove("dark");
          if (t === "amoled" || t === "black") {
            document.documentElement.classList.add("dark");
          }
          document.documentElement.setAttribute("data-theme", t);
        }, theme);

        // 1. Locate hero image and verify naturalWidth > 0
        const heroImg = page.locator("#home img[src*='group-portrait']").first();
        await expect(heroImg).toBeVisible();

        const naturalWidth = await heroImg.evaluate(
          (img: HTMLImageElement) => img.naturalWidth
        );
        expect(naturalWidth).toBeGreaterThan(0);

        // 2. Sample elementsFromPoint in the middle-right area (outside title text)
        const sampleResult = await page.evaluate(() => {
          const hero = document.getElementById("home");
          if (!hero) return { found: false, heroImgPresent: false, topElement: "" };

          const rect = hero.getBoundingClientRect();
          // Sample point near right flank where photo faces/people sit
          const sampleX = rect.left + rect.width * 0.75;
          const sampleY = rect.top + rect.height * 0.5;

          const elements = document.elementsFromPoint(sampleX, sampleY);
          const hasImage = elements.some((el) => el.tagName.toLowerCase() === "img");
          const topElement = elements[0]?.tagName.toLowerCase() || "";
          const topClasses = elements[0]?.className || "";

          return {
            found: true,
            hasImage,
            topElement,
            topClasses,
            elementsCount: elements.length,
          };
        });

        expect(sampleResult.found).toBe(true);
        expect(sampleResult.hasImage).toBe(true);

        // Capture screenshot artifact
        await page.screenshot({
          path: `test-results/hero-${theme}-${vp.name}.png`,
          fullPage: false,
        });
      });
    }
  }
});
