import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1440, 1920] as const;

assertDevBranchDatabase("Public branch map visual test");

test.describe("Public dynamic branches", () => {
  test("renders the database branches without overflow in all themes, locales and target widths", async ({ browser }) => {
    test.setTimeout(300_000);
    fs.mkdirSync("evidence/task-05/t4e", { recursive: true });
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ locale: locale === "ar" ? "ar-MA" : "en-US", viewport: { width: 360, height: 850 } });
        await context.addInitScript(({ localeValue, themeValue }) => {
          localStorage.setItem("ihyaa-locale", localeValue);
          localStorage.setItem("ihyaa-theme", themeValue);
          document.cookie = `ihyaa-theme=${themeValue}; path=/`;
        }, { localeValue: locale, themeValue: theme });
        const page = await context.newPage();
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          const section = page.locator("#branches");
          await expect(section).toBeVisible({ timeout: 30_000 });
          await expect(section.locator("li")).toHaveCount(4, { timeout: 30_000 });
          await expect(section.getByRole("heading", { level: 3 }).first()).toBeVisible();
          const markers = section.locator('button[aria-label*="—"]');
          await expect(markers).toHaveCount(4, { timeout: 30_000 });

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await section.screenshot({ path: `evidence/task-05/t4e/branches-${width}-${theme}-${locale}.png` });
          }

          const firstMarker = markers.first();
          await firstMarker.focus();
          await expect(firstMarker).toHaveAttribute("aria-pressed", "true");
          await expect(section.locator("ul").getByRole("button", { pressed: true })).toHaveCount(1);

          const search = section.getByRole("textbox", { name: locale === "ar" ? "البحث عن الفروع" : "Search branches" });
          await search.fill(locale === "ar" ? "طاطا" : "Tata");
          await expect(section.locator("li")).toHaveCount(1);
          const regionId = await section.locator("li").first().getAttribute("data-branch-region");
          expect(regionId).toBeTruthy();
          await search.fill("");
          const regionButton = section.locator(`[data-region-id="${regionId}"]`);
          const expectedRegionCount = Number(await regionButton.locator("span").innerText());
          await regionButton.click();
          await expect(regionButton).toHaveAttribute("aria-pressed", "true");
          await expect(section.locator("li")).toHaveCount(expectedRegionCount);
        } finally {
          await context.close();
        }
      }
    }
  });
});
