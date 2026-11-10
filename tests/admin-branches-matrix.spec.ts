import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { ensureTestUser, loginAs, TEST_ADMIN } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1440] as const;

assertDevBranchDatabase("Admin branches visual matrix");

test.describe("Admin branches responsive surface", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
  });

  test.afterAll(async () => {
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.deleteMany({ where: { email: TEST_ADMIN.email } });
  });

  test("list and full-screen editor render across themes, locales and widths", async ({ browser }) => {
    test.setTimeout(240_000);
    fs.mkdirSync("evidence/task-05/t4d", { recursive: true });

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ viewport: { width: 360, height: 850 } });
        await context.addInitScript(({ localeValue, themeValue }) => {
          localStorage.setItem("ihyaa-locale", localeValue);
          localStorage.setItem("ihyaa-theme", themeValue);
          document.cookie = `ihyaa-theme=${themeValue}; path=/`;
        }, { localeValue: locale, themeValue: theme });
        const page = await context.newPage();
        try {
          await loginAs(page, TEST_ADMIN, "/admin/branches");
          await expect(page).toHaveURL(/\/admin\/branches/);
          await expect(page.getByRole("heading", { name: /manage branches|إدارة الفروع/i })).toBeVisible();
          await expect(page.locator("[data-branch-id]")).toHaveCount(4, { timeout: 30_000 });
          await expect(page.locator("[data-sonner-toast]")).toBeHidden({ timeout: 10_000 });

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await page.screenshot({ path: `evidence/task-05/t4d/admin-list-${width}-${theme}-${locale}.png`, fullPage: true });
          }

          await page.setViewportSize({ width: 320, height: 850 });
          await page.getByRole("button", { name: /add branch|إضافة فرع/i }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog.getByRole("heading", { name: /add a branch|إضافة فرع/i })).toBeVisible();
          await expect(dialog.locator("[data-editor-pin]")).toBeVisible();
          await dialog.screenshot({ path: `evidence/task-05/t4d/editor-city-320-${theme}-${locale}.png` });
          await dialog.getByRole("button", { name: /custom place|مكان مخصص/i }).click();
          await expect(dialog.getByLabel(/branch name|اسم الفرع/i).first()).toBeVisible();
          await dialog.screenshot({ path: `evidence/task-05/t4d/editor-custom-320-${theme}-${locale}.png` });
          await dialog.getByRole("button", { name: /cancel|إلغاء/i }).click();
        } finally {
          await context.close();
        }
      }
    }
  });
});
