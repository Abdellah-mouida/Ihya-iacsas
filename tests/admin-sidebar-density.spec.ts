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

  test("desktop and mobile navigation keep headers and footers fixed while only links scroll", async ({ page }) => {
    test.setTimeout(120_000);
    fs.mkdirSync("evidence/task-07/t2", { recursive: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAs(page, TEST_ADMIN, "/admin");
    const sidebar = page.getByTestId("admin-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Branches|الفروع/ })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /Logs|السجلات/ })).toBeVisible();

    for (const height of [600, 700, 768, 900]) {
      await page.setViewportSize({ width: 1280, height });
      const metrics = await sidebar.evaluate((element) => {
        const nav = element.querySelector('[data-testid="admin-sidebar-nav"]')!;
        const header = element.querySelector('[data-testid="admin-sidebar-header"]')!;
        const footer = element.querySelector('[data-testid="admin-sidebar-footer"]')!;
        return ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollbarWidth: getComputedStyle(element).scrollbarWidth,
        webkitScrollbarDisplay: getComputedStyle(element, "::-webkit-scrollbar").display,
        navOverflowY: getComputedStyle(nav).overflowY,
        navScrollHeight: nav.scrollHeight,
        navClientHeight: nav.clientHeight,
        headerTop: header.getBoundingClientRect().top,
        footerBottom: footer.getBoundingClientRect().bottom,
        logoutBottom: element.querySelector('[data-testid="admin-logout-btn"]')!.getBoundingClientRect().bottom,
      });
      });
      expect(metrics.navOverflowY).toBe("auto");
      expect(metrics.headerTop).toBeGreaterThanOrEqual(0);
      expect(metrics.footerBottom).toBeLessThanOrEqual(height + 1);
      expect(metrics.navClientHeight).toBeGreaterThan(0);
      expect(metrics.logoutBottom).toBeLessThanOrEqual(height);
      await sidebar.getByTestId("admin-sidebar-nav").evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(sidebar.getByRole("link", { name: /Logs|السجلات/ })).toBeVisible();
      await sidebar.getByTestId("admin-sidebar-nav").evaluate((element) => { element.scrollTop = 0; });
      await page.screenshot({ path: `evidence/task-07/t2/desktop-${height}.png`, fullPage: false });
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
        navOverflowY: getComputedStyle(element.querySelector('[data-testid="admin-mobile-nav"]')!).overflowY,
        navClientHeight: element.querySelector('[data-testid="admin-mobile-nav"]')!.clientHeight,
      }));
      expect(metrics.navOverflowY).toBe("auto");
      expect(metrics.navClientHeight).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await drawer.getByTestId("admin-mobile-nav").evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect(drawer.getByRole("link", { name: /Logs|السجلات/ })).toBeVisible();
      await drawer.getByTestId("admin-mobile-nav").evaluate((element) => { element.scrollTop = 0; });
      await page.screenshot({ path: `evidence/task-07/t2/mobile-${height}.png`, fullPage: false });
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
        await page.screenshot({ path: `evidence/task-07/t2/mobile-360-${theme}-${locale}.png`, fullPage: false });
        await page.setViewportSize({ width: 768, height: 768 });
        await page.screenshot({ path: `evidence/task-07/t2/mobile-768-${theme}-${locale}.png`, fullPage: false });
        await page.setViewportSize({ width: 1440, height: 768 });
        await page.screenshot({ path: `evidence/task-07/t2/desktop-1440-${theme}-${locale}.png`, fullPage: false });
      }
    }
  });
});
