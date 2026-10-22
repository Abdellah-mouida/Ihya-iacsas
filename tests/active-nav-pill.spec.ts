import { test, expect } from "@playwright/test";

test.describe("Task 3: Active Nav Link Highlight with Framer Motion layoutId Pill", () => {
  test("sliding pill indicator marks active route and updates on navigation", async ({
    page,
  }) => {
    // 1. Visit Home (/)
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const homeLink = page.locator('header nav ul a[href="/"]');
    await expect(homeLink).toHaveAttribute("aria-current", "page");

    // Check layoutId pill is rendered under active link
    const homePill = page.locator('header nav ul a[href="/"] span.bg-primary');
    await expect(homePill).toBeVisible();

    // 2. Navigate to /events
    const eventsLink = page.locator('header nav ul a[href="/events"]');
    await eventsLink.click();
    await page.waitForURL((url) => url.pathname.includes("/events"));

    await expect(eventsLink).toHaveAttribute("aria-current", "page");
    await expect(homeLink).not.toHaveAttribute("aria-current", "page");

    // Check sliding pill moved to /events
    const eventsPill = page.locator('header nav ul a[href="/events"] span.bg-primary');
    await expect(eventsPill).toBeVisible();

    // 3. Navigate to /gallery
    const galleryLink = page.locator('header nav ul a[href="/gallery"]');
    await galleryLink.click();
    await page.waitForURL((url) => url.pathname.includes("/gallery"));

    await expect(galleryLink).toHaveAttribute("aria-current", "page");
    await expect(eventsLink).not.toHaveAttribute("aria-current", "page");

    const galleryPill = page.locator('header nav ul a[href="/gallery"] span.bg-primary');
    await expect(galleryPill).toBeVisible();
  });

  test("mobile navigation marks active link with primary styling and aria-current", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    // Open mobile hamburger menu
    const menuBtn = page.locator('[data-testid="navbar-mobile-menu-btn"]');
    await menuBtn.click();

    const mobileEventsLink = page.locator('dialog a[href="/events"], div[role="dialog"] a[href="/events"]').first();
    await expect(mobileEventsLink).toBeVisible();
    await expect(mobileEventsLink).toHaveAttribute("aria-current", "page");
  });
});
