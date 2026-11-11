import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { ensureTestUser, loginAs, TEST_ADMIN, assertDevBranchDatabase } from "./helpers/admin-auth";

assertDevBranchDatabase("Admin sidebar density test");

test.describe("admin navigation density", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
  });

  test.afterAll(async () => {
    assertDevBranchDatabase("Admin sidebar density cleanup");
    const user = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email }, select: { id: true } });
    if (user) await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email: TEST_ADMIN.email } });
  });

  test("desktop menu and mobile drawer fit at target heights without visible scrollbars", async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync("evidence/task-06/t9", { recursive: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, TEST_ADMIN, "/admin");
    const sidebar = page.getByTestId("admin-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Branches|الفروع/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Logs|السجلات/ })).toBeVisible();

    for (const height of [600, 700, 768, 900]) {
      await page.setViewportSize({ width: 1280, height });
      const metrics = await sidebar.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollbarWidth: getComputedStyle(element).scrollbarWidth,
        webkitScrollbarDisplay: getComputedStyle(element, "::-webkit-scrollbar").display,
        logoutBottom: element.querySelector('[data-testid="admin-logout-btn"]')!.getBoundingClientRect().bottom,
      }));
      expect(metrics.scrollHeight, `desktop sidebar content fits at ${height}px`).toBeLessThanOrEqual(metrics.clientHeight + 1);
      expect(metrics.scrollbarWidth).toBe("none");
      expect(metrics.webkitScrollbarDisplay).toBe("none");
      expect(metrics.logoutBottom).toBeLessThanOrEqual(height);
      await page.screenshot({ path: `evidence/task-06/t9/desktop-${height}.png`, fullPage: false });
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole("button", { name: "Toggle Navigation" }).click();
    const drawer = page.getByTestId("admin-mobile-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: /Branches|الفروع/ })).toBeVisible();
    await expect(drawer.getByRole("link", { name: /Logs|السجلات/ })).toHaveCount(1);

    for (const height of [600, 700, 768, 900]) {
      await page.setViewportSize({ width: 390, height });
      const metrics = await drawer.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollbarWidth: getComputedStyle(element).scrollbarWidth,
        webkitScrollbarDisplay: getComputedStyle(element, "::-webkit-scrollbar").display,
      }));
      expect(metrics.scrollHeight, `mobile drawer content fits at ${height}px`).toBeLessThanOrEqual(metrics.clientHeight + 1);
      expect(metrics.scrollbarWidth).toBe("none");
      expect(metrics.webkitScrollbarDisplay).toBe("none");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: `evidence/task-06/t9/mobile-${height}.png`, fullPage: false });
    }

    for (const locale of ["ar", "en"] as const) {
      const currentLocale = await page.evaluate(() => localStorage.getItem("ihyaa-locale") || "ar");
      if (currentLocale !== locale) {
        await page.getByTestId("language-switcher-btn").first().click();
        await expect.poll(() => page.evaluate(() => localStorage.getItem("ihyaa-locale"))).toBe(locale);
      }

      for (const theme of ["light", "sunset", "amoled", "black"] as const) {
        await page.locator('[data-testid="navbar-theme-toggle"]:visible').first().click();
        const themeOption = page.getByTestId(`theme-option-${theme}`);
        await expect(themeOption).toBeVisible();
        await themeOption.click({ force: true });
        await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe(theme);

        await page.setViewportSize({ width: 360, height: 768 });
        await page.screenshot({ path: `evidence/task-06/t9/mobile-360-${theme}-${locale}.png`, fullPage: false });
        await page.setViewportSize({ width: 768, height: 768 });
        await page.screenshot({ path: `evidence/task-06/t9/mobile-768-${theme}-${locale}.png`, fullPage: false });
        await page.setViewportSize({ width: 1440, height: 768 });
        await page.screenshot({ path: `evidence/task-06/t9/desktop-1440-${theme}-${locale}.png`, fullPage: false });
      }
    }
  });
});
