import { test, expect } from "@playwright/test";

test.describe("Global Navigation ActiveLink Highlighting", () => {
  test("Desktop navigation marks active page with aria-current and active styles", async ({ page }) => {
    // Navigate to Home
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // The brand logo is the first link with href='/'. The desktop nav link is inside the ul.
    const homeNavLink = page.locator("nav ul a[href='/']").first();
    await expect(homeNavLink).toHaveAttribute("aria-current", "page");

    // Navigate to Events
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    const eventsLink = page.locator("nav ul a[href='/events']").first();
    await expect(eventsLink).toHaveAttribute("aria-current", "page");
  });

  test("Mobile navigation highlights active link with aria-current", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    // Open mobile menu
    const menuBtn = page.getByRole("button", { name: /قائمة التنقل|Menu|navigation/i }).or(page.locator("button[aria-label*='قائمة']")).first();
    await menuBtn.click();

    // Check that /events link inside mobile menu has aria-current="page"
    const mobileEventsLink = page.locator("div[role='dialog'], nav").locator("a[href='/events']").last();
    await expect(mobileEventsLink).toHaveAttribute("aria-current", "page");
  });

  test("Footer navigation highlights active links", async ({ page }) => {
    await page.goto("/terms");
    await page.waitForLoadState("domcontentloaded");

    const termsLink = page.locator("footer a[href='/terms']").first();
    await expect(termsLink).toHaveAttribute("aria-current", "page");

    await page.goto("/privacy");
    await page.waitForLoadState("domcontentloaded");

    const privacyLink = page.locator("footer a[href='/privacy']").first();
    await expect(privacyLink).toHaveAttribute("aria-current", "page");
  });
});
