import { test, expect, devices } from "@playwright/test";
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

test.describe("Profile and settings mobile containment", () => {
  test.setTimeout(600_000);
  test.beforeAll(() => fs.mkdirSync("evidence/task-2", { recursive: true }));

  test("profile and settings controls remain inside their surfaces at 320px, 360px and 390px", async ({ page, browser }) => {
    assertDevBranchDatabase("Profile and settings mobile UI test");
    const user = await createSyntheticUser("Profile and settings mobile UI test account");
    const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");

    try {
      await page.goto(`/login?callbackUrl=${encodeURIComponent("/onboarding")}`);
      await page.locator('[data-testid="login-email-input"]').fill(user.email);
      await page.locator('[data-testid="login-password-input"]').fill(user.password);
      await page.locator('[data-testid="login-submit-btn"]').click();
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
      await prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } });
      const storageState = await page.context().storageState();

      for (const width of [320, 360, 390]) {
        for (const locale of ["ar", "en"] as const) {
          for (const theme of ["light"] as const) {
          const context = await browser.newContext({
            ...devices["iPhone 13"],
            viewport: { width, height: 844 },
            baseURL,
            storageState,
            locale: locale === "ar" ? "ar-MA" : "en-US",
          });
          try {
            await context.addInitScript(({ localeValue, themeValue }) => {
              localStorage.setItem("ihyaa-locale", localeValue);
              localStorage.setItem("ihyaa-theme", themeValue);
            }, { localeValue: locale, themeValue: theme });
            const mobilePage = await context.newPage();
            await mobilePage.goto("/profile", { waitUntil: "domcontentloaded" });
            await expect(mobilePage.locator('[data-testid="profile-view-container"]')).toBeVisible();
            expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

            const profileSurface = mobilePage.locator('[data-testid="profile-view-container"] > div').first();
            const editAction = mobilePage.locator('[data-testid="profile-edit-settings-btn"]');
            const profileBox = await profileSurface.boundingBox();
            const editBox = await editAction.boundingBox();
            expect(profileBox && editBox).toBeTruthy();
            if (profileBox && editBox) {
              expect(editBox.x).toBeGreaterThanOrEqual(profileBox.x);
              expect(editBox.x + editBox.width).toBeLessThanOrEqual(profileBox.x + profileBox.width + 1);
            }
            const bookingsHeader = mobilePage.locator('[data-testid="profile-bookings-section"]');
            const [bookingsHeadingBox, browseButtonBox] = await Promise.all([
              bookingsHeader.locator("h2").boundingBox(),
              bookingsHeader.getByRole("link").first().boundingBox(),
            ]);
            expect(bookingsHeadingBox && browseButtonBox).toBeTruthy();
            if (bookingsHeadingBox && browseButtonBox) {
              const overlaps =
                bookingsHeadingBox.x < browseButtonBox.x + browseButtonBox.width &&
                bookingsHeadingBox.x + bookingsHeadingBox.width > browseButtonBox.x &&
                bookingsHeadingBox.y < browseButtonBox.y + browseButtonBox.height &&
                bookingsHeadingBox.y + bookingsHeadingBox.height > browseButtonBox.y;
              expect(overlaps, `${width}px ${locale}/${theme}: bookings heading and action do not overlap`).toBe(false);
            }
            await mobilePage.screenshot({ path: `evidence/task-2/profile-${width}-${locale}-${theme}.png`, fullPage: true });

            await editAction.click();
            await mobilePage.waitForURL(/\/settings(?:\?|$)/, { timeout: 30_000 });
            await expect(mobilePage.locator('[data-testid="settings-profile-section"]')).toBeVisible({ timeout: 30_000 });
            expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            const settingsSurface = mobilePage.locator('[data-testid="settings-profile-section"]');
            const saveAction = mobilePage.locator('[data-testid="settings-save-profile-btn"]');
            const [settingsBox, saveBox] = await Promise.all([settingsSurface.boundingBox(), saveAction.boundingBox()]);
            expect(settingsBox && saveBox).toBeTruthy();
            if (settingsBox && saveBox) {
              expect(saveBox.x).toBeGreaterThanOrEqual(settingsBox.x);
              expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(settingsBox.x + settingsBox.width + 1);
            }
            await mobilePage.screenshot({ path: `evidence/task-2/settings-${width}-${locale}-${theme}.png`, fullPage: true });
          } finally {
            await context.close();
          }
          }
        }
      }
    } finally {
      assertDevBranchDatabase("Profile and settings mobile UI test cleanup");
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await removeSyntheticUser(user.id);
    }
  });
});
