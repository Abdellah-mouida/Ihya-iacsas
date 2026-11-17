import fs from "node:fs";
import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [360, 768, 1440] as const;
const PAGES = [
  { name: "home", path: "/" },
  { name: "events", path: "/events" },
  { name: "gallery", path: "/gallery" },
] as const;

test("shared and local section heading kickers render across theme, locale, and width", async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync("evidence/task-07/t8/kickers", { recursive: true });

  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        locale: locale === "ar" ? "ar-MA" : "en-US",
        viewport: { width: 360, height: 900 },
      });
      await context.addInitScript(({ localeValue, themeValue }) => {
        localStorage.setItem("ihyaa-locale", localeValue);
        localStorage.setItem("ihyaa-theme", themeValue);
        document.cookie = `ihyaa-theme=${themeValue}; path=/`;
      }, { localeValue: locale, themeValue: theme });
      const page = await context.newPage();

      try {
        for (const route of PAGES) {
          await page.goto(route.path, { waitUntil: "domcontentloaded" });
          const kicker = page.locator("main h2").first();
          await expect(kicker).toBeVisible({ timeout: 30_000 });

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 900 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            const filename = `${route.name}-${width}-${theme}-${locale}.png`;
            await page.screenshot({ path: `evidence/task-07/t8/kickers/${filename}` });
          }
        }
      } finally {
        await context.close();
      }
    }
  }
});
