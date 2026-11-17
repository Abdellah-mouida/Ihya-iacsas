import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { loginAdmin } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const ROUTES = [
  { name: "home", path: "/", ready: '[data-testid="site-atmosphere"]' },
  { name: "profile", path: "/profile", ready: '[data-testid="profile-view-container"]' },
  { name: "admin", path: "/admin", ready: "main h1" },
] as const;

test.describe("Shared texture route screenshot matrix", () => {
  test.setTimeout(300_000);

  test("home, profile and admin render in both locales and themes at mobile and desktop widths", async ({
    page,
    browser,
  }) => {
    fs.mkdirSync("evidence/task-3", { recursive: true });
    await loginAdmin(page);
    const storageState = await page.context().storageState();
    const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          baseURL,
          storageState,
          locale: locale === "ar" ? "ar-MA" : "en-US",
          viewport: { width: 360, height: 800 },
        });
        try {
          await context.addInitScript(({ localeValue, themeValue }) => {
            localStorage.setItem("ihyaa-locale", localeValue);
            localStorage.setItem("ihyaa-theme", themeValue);
          }, { localeValue: locale, themeValue: theme });
          const matrixPage = await context.newPage();

          for (const width of [360, 1440] as const) {
            await matrixPage.setViewportSize({ width, height: width === 360 ? 800 : 900 });
            for (const route of ROUTES) {
              await matrixPage.goto(route.path, { waitUntil: "domcontentloaded" });
              await expect(matrixPage.locator(route.ready), `${route.name} should render`).toBeVisible({ timeout: 30_000 });
              await matrixPage.screenshot({
                path: `evidence/task-3/texture-${route.name}-${width}-${theme}-${locale}.png`,
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
