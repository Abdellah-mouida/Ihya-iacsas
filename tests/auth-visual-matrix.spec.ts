import { test, expect } from "@playwright/test";
import fs from "node:fs";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1440] as const;
const ROUTES = [
  { path: "/login", ready: '[data-testid="login-view"]' },
  { path: "/signup", ready: '[data-testid="signup-view"]' },
  { path: "/forgot-password", ready: '[data-testid="forgot-title"]' },
] as const;

test.describe("auth visual matrix", () => {
  test.setTimeout(300_000);

  test("keeps the three auth forms usable and bounded across themes, locales, and widths", async ({ browser }) => {
    fs.mkdirSync("evidence/task-06/t7", { recursive: true });

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          locale: locale === "ar" ? "ar-MA" : "en-US",
          viewport: { width: 1440, height: 1000 },
        });
        try {
          await context.addInitScript(({ localeValue, themeValue }) => {
            localStorage.setItem("ihyaa-locale", localeValue);
            localStorage.setItem("ihyaa-theme", themeValue);
          }, { localeValue: locale, themeValue: theme });
          const page = await context.newPage();

          for (const route of ROUTES) {
            for (const width of WIDTHS) {
              await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
              await page.goto(route.path, { waitUntil: "domcontentloaded" });
              await expect(page.locator(route.ready).first()).toBeVisible();
              await expect(page.locator("input").first()).toBeVisible();
              expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

              const card = route.path === "/forgot-password"
                ? page.locator(".rounded-3xl").first()
                : page.locator(route.ready).first();
              const backdropFilter = await card.evaluate((element) => getComputedStyle(element).backdropFilter);
              expect(backdropFilter, `${locale}/${theme}/${route.path} card has no repainting blur`).toBe("none");

              await page.screenshot({
                path: `evidence/task-06/t7/${route.path.slice(1)}-${width}-${theme}-${locale}.png`,
                fullPage: true,
              });
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  });
});
