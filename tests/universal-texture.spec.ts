import { test, expect } from "@playwright/test";

test.describe("Task 1: Universal Texture and Pattern Verification", () => {
  test("homepage renders the shared root atmosphere with an inline masked khatam pattern", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Assert PageBackground container exists
    const bg = page.locator('[data-testid="page-background"]');
    await expect(bg).toBeVisible();

    // Assert the single root atmosphere and its inline, edge-masked khatam SVG.
    const texture = page.locator('[data-testid="site-atmosphere"]');
    await expect(texture).toBeAttached();
    await expect(texture.locator("pattern#site-khatam-pattern")).toBeAttached();
    await expect(texture.locator("mask#site-pattern-mask")).toBeAttached();
  });

  test("auth pages use the theme-reactive root atmosphere", async ({
    page,
  }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-testid="site-atmosphere"]')).toBeAttached();
    await expect(page.locator("#site-pattern-mask")).toBeAttached();
  });
});
