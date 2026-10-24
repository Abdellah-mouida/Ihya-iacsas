import { test, expect } from "@playwright/test";
import { loginAs, TEST_REGULAR_USER, ensureTestUser } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"] as const;

test.describe("Task 4: Profile Page Soft Shadows & Hover Effects", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_REGULAR_USER);
  });

  for (const theme of THEMES) {
    test(`profile cards apply soft shadows without clipping in ${theme} theme`, async ({ page }) => {
      await loginAs(page, TEST_REGULAR_USER, "/profile");
      await page.waitForLoadState("domcontentloaded");

      // Set theme attribute directly and in localStorage
      await page.evaluate((th) => {
        document.documentElement.setAttribute("data-theme", th);
        if (th === "black" || th === "amoled") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }, theme);

      const profileContainer = page.locator('[data-testid="profile-view-container"]');
      await expect(profileContainer).toBeVisible({ timeout: 15000 });

      // Check header card shadow
      const headerCard = profileContainer.locator("> div").first();
      await expect(headerCard).toBeVisible();

      const headerBoxShadow = await headerCard.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });
      expect(headerBoxShadow).not.toBe("none");
      expect(headerBoxShadow.length).toBeGreaterThan(0);

      // Check overflow-hidden is not on the card root causing shadow clipping
      const overflow = await headerCard.evaluate((el) => {
        return window.getComputedStyle(el).overflow;
      });
      expect(overflow).not.toBe("hidden");

      // Verify bookings section exists and has shadow
      const bookingsSection = page.locator('[data-testid="profile-bookings-section"]');
      await expect(bookingsSection).toBeVisible();
      const bookingsBoxShadow = await bookingsSection.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });
      expect(bookingsBoxShadow).not.toBe("none");

      // Take a visual snapshot for reference
      await page.screenshot({
        path: `test-results/profile-shadows-${theme}.png`,
        fullPage: false,
      });
    });
  }
});
