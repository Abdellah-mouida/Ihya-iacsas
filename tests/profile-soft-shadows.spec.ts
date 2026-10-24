import { test, expect } from "@playwright/test";
import { loginAs, TEST_REGULAR_USER, ensureTestUser } from "./helpers/admin-auth";
import fs from "fs";
import path from "path";

const THEMES = ["light", "sunset", "amoled", "black"] as const;

function extractMaxAlpha(boxShadowStr: string): number {
  let maxAlpha = 0;
  // Match rgba(...), rgb(...), lab(... / alpha), oklch(... / alpha)
  // 1. lab(... / alpha) or oklch(... / alpha)
  const slashMatches = boxShadowStr.matchAll(/(?:lab|oklch|color)\([^/]+\/\s*([\d.]+)[%)]/g);
  for (const m of slashMatches) {
    let alpha = parseFloat(m[1]);
    if (m[0].includes("%")) alpha = alpha / 100;
    if (!isNaN(alpha) && alpha > maxAlpha) {
      maxAlpha = alpha;
    }
  }

  // 2. rgba(r, g, b, a)
  const rgbaMatches = boxShadowStr.matchAll(/rgba?\(([^)]+)\)/g);
  for (const m of rgbaMatches) {
    const parts = m[1].split(",").map((s) => s.trim());
    if (parts.length === 4) {
      const alpha = parseFloat(parts[3]);
      if (!isNaN(alpha) && alpha > maxAlpha) {
        maxAlpha = alpha;
      }
    }
  }
  return maxAlpha;
}

test.describe("Task 0: Meaningful Profile Soft Shadows Tests", () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await ensureTestUser(TEST_REGULAR_USER);
    fs.mkdirSync(path.join(process.cwd(), "evidence/task-0"), { recursive: true });
  });

  for (const theme of THEMES) {
    test(`profile cards compute soft shadows with alpha <= 0.25 in ${theme} theme`, async ({ page }) => {
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

      // 1. Check header card shadow & alpha
      const headerCard = profileContainer.locator("> div").first();
      await expect(headerCard).toBeVisible();

      const headerBoxShadow = await headerCard.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });
      console.log(`[Computed BoxShadow for ${theme}]:`, headerBoxShadow);

      // Assert non-empty and not 'none'
      expect(headerBoxShadow).not.toBe("none");
      expect(headerBoxShadow.length).toBeGreaterThan(0);

      // Extract and assert shadow alpha <= 0.25 (soft shadows constraint)
      const headerAlpha = extractMaxAlpha(headerBoxShadow);
      expect(headerAlpha).toBeGreaterThan(0);
      expect(headerAlpha).toBeLessThanOrEqual(0.25);

      // Check overflow-hidden is not on the card root causing shadow clipping
      const overflow = await headerCard.evaluate((el) => {
        return window.getComputedStyle(el).overflow;
      });
      expect(overflow).not.toBe("hidden");

      // 2. Verify bookings section exists, has shadow, and has alpha <= 0.25
      const bookingsSection = page.locator('[data-testid="profile-bookings-section"]');
      await expect(bookingsSection).toBeVisible();
      const bookingsBoxShadow = await bookingsSection.evaluate((el) => {
        return window.getComputedStyle(el).boxShadow;
      });
      expect(bookingsBoxShadow).not.toBe("none");
      const bookingsAlpha = extractMaxAlpha(bookingsBoxShadow);
      expect(bookingsAlpha).toBeGreaterThan(0);
      expect(bookingsAlpha).toBeLessThanOrEqual(0.25);

      // 3. Write evidence screenshot to git-ignored evidence/ folder
      const evidencePath = path.join(
        process.cwd(),
        `evidence/task-0/profile-${theme}-1440.png`
      );
      await page.screenshot({
        path: evidencePath,
        fullPage: false,
      });
      expect(fs.existsSync(evidencePath)).toBe(true);
    });
  }
});
