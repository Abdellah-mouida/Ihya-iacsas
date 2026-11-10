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
    const user = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email }, select: { id: true } });
    if (user) {
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("list and full-screen editor render across themes, locales and widths", async ({ browser }) => {
    test.setTimeout(240_000);
    fs.mkdirSync("evidence/task-06/t5", { recursive: true });

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
          await expect.poll(() => page.locator("[data-branch-id]").count(), { timeout: 30_000 }).toBeGreaterThan(0);
          await expect(page.locator("[data-sonner-toast]")).toBeHidden({ timeout: 10_000 });

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await page.screenshot({ path: `evidence/task-06/t5/admin-list-${width}-${theme}-${locale}.png`, fullPage: true });
          }

          await page.setViewportSize({ width: 320, height: 850 });
          await page.getByRole("button", { name: /add branch|إضافة فرع/i }).click();
          const dialog = page.getByRole("dialog");
          await expect(dialog.getByRole("heading", { name: /add a branch|إضافة فرع/i })).toBeVisible();
          await expect(dialog.locator("[data-editor-pin]")).toBeVisible();
          await expect(dialog.getByRole("button", { name: /province or prefecture|إقليم أو عمالة/i })).toHaveCount(0);
          await dialog.screenshot({ path: `evidence/task-06/t5/editor-city-320-${theme}-${locale}.png` });
          await dialog.getByRole("button", { name: /custom place|مكان مخصص/i }).click();
          await expect(dialog.getByLabel(/branch name|اسم الفرع/i).first()).toBeVisible();
          await expect(dialog.getByRole("status")).toBeVisible();
          await dialog.screenshot({ path: `evidence/task-06/t5/editor-custom-320-${theme}-${locale}.png` });
          await dialog.getByRole("button", { name: /cancel|إلغاء/i }).click();
        } finally {
          await context.close();
        }
      }
    }
  });
});
