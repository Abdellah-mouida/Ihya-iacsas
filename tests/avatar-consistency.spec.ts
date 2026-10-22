import { test, expect } from "@playwright/test";
import { ensureTestUser, TEST_REGULAR_USER } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"];

test.describe("Task 1: Deterministic Avatar Consistency Across Pages", () => {
  test.setTimeout(60000);
  let testUser: { id: string; email: string; name: string };

  test.beforeAll(async () => {
    // Synthetic account without profile picture
    const created = await ensureTestUser({
      ...TEST_REGULAR_USER,
      image: null,
    } as any);
    testUser = {
      id: created.id,
      email: created.email ?? TEST_REGULAR_USER.email,
      name: created.name || TEST_REGULAR_USER.fullName,
    };
  });

  for (const theme of THEMES) {
    test(`renders identical avatar letter and background in ${theme} theme across navbar, dropdown, /profile, /settings`, async ({
      browser,
    }) => {
      // Use clean context per test
      const context = await browser.newContext();
      const page = await context.newPage();

      // 1. Log in via credentials
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      // Apply theme
      await page.evaluate((t) => {
        document.documentElement.classList.remove("dark");
        if (t === "amoled" || t === "black") {
          document.documentElement.classList.add("dark");
        }
        document.documentElement.setAttribute("data-theme", t);
      }, theme);

      // Sign in
      await page.locator('[data-testid="login-email-input"]').fill(testUser.email);
      await page.locator('[data-testid="login-password-input"]').fill(TEST_REGULAR_USER.password);
      await page.locator('[data-testid="login-submit-btn"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });

      // 2. Inspect Navbar Avatar
      const navAvatar = page.locator('[data-testid="navbar-user-menu-btn"] [data-testid="user-avatar"]');
      await expect(navAvatar).toBeVisible({ timeout: 10000 });

      const navLetter = await navAvatar.getAttribute("data-letter");
      const navPalette = await navAvatar.getAttribute("data-palette");

      // Open dropdown to inspect dropdown header avatar
      await page.locator('[data-testid="navbar-user-menu-btn"]').click();
      const dropdownAvatar = page.locator('[role="menu"] [data-testid="user-avatar"]');
      await expect(dropdownAvatar).toBeVisible();

      const dropdownLetter = await dropdownAvatar.getAttribute("data-letter");
      const dropdownPalette = await dropdownAvatar.getAttribute("data-palette");

      expect(dropdownLetter).toBe(navLetter);
      expect(dropdownPalette).toBe(navPalette);

      // 3. Navigate to /profile and inspect
      await page.goto("/profile");
      await page.waitForLoadState("domcontentloaded");

      const profileAvatar = page.locator('[data-testid="profile-view-container"] [data-testid="user-avatar"]');
      await expect(profileAvatar).toBeVisible({ timeout: 10000 });

      const profileLetter = await profileAvatar.getAttribute("data-letter");
      const profilePalette = await profileAvatar.getAttribute("data-palette");

      expect(profileLetter).toBe(navLetter);
      expect(profilePalette).toBe(navPalette);

      // 4. Navigate to /settings and inspect
      await page.goto("/settings");
      await page.waitForLoadState("domcontentloaded");

      const settingsAvatar = page.locator('main [data-testid="user-avatar"]').first();
      await expect(settingsAvatar).toBeVisible();

      const settingsLetter = await settingsAvatar.getAttribute("data-letter");
      const settingsPalette = await settingsAvatar.getAttribute("data-palette");

      expect(settingsLetter).toBe(navLetter);
      expect(settingsPalette).toBe(navPalette);

      // Take visual screenshot artifact
      await page.screenshot({
        path: `test-results/avatar-consistency-${theme}.png`,
        fullPage: false,
      });

      await context.close();
    });
  }
});
