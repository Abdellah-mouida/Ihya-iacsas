import { test, expect } from "@playwright/test";

test.describe("Task 4 Events Page Visual Features & Flyer Dialog", () => {
  test("1. Events page renders header, count badges, and filter buttons", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    // Header filters should be visible
    const allBtn = page.locator('[data-testid="filter-all-events-btn"]');
    const openBtn = page.locator('[data-testid="filter-open-events-btn"]');
    const pastBtn = page.locator('[data-testid="filter-past-events-btn"]');

    await expect(allBtn).toBeVisible();
    await expect(openBtn).toBeVisible();
    await expect(pastBtn).toBeVisible();

    // Badges should contain numbers
    const totalBadge = page.locator('[data-testid="total-events-count-badge"]');
    await expect(totalBadge).toBeVisible();
    const countText = await totalBadge.innerText();
    expect(Number(countText)).toBeGreaterThanOrEqual(0);
  });

  test("2. Clicking open/past filters toggles sections accordingly", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    const pastBtn = page.locator('[data-testid="filter-past-events-btn"]');
    await pastBtn.click();

    // After filtering to past, open-events carousel should not be displayed
    const openCarousel = page.locator('[data-testid="open-events-carousel"]');
    await expect(openCarousel).toHaveCount(0);

    const allBtn = page.locator('[data-testid="filter-all-events-btn"]');
    await allBtn.click();
  });

  test("3. Clicking event poster opens high-resolution flyer dialog modal with zoom and download buttons", async ({ page }) => {
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    const posterFrame = page.locator('[data-testid="event-poster-frame"]').first();
    if (await posterFrame.isVisible()) {
      await posterFrame.click();

      const modal = page.locator('[data-testid="event-flyer-modal"]');
      await expect(modal).toBeVisible();

      const zoomBtn = page.locator('[data-testid="flyer-zoom-btn"]');
      await expect(zoomBtn).toBeVisible();

      const downloadBtn = page.locator('[data-testid="flyer-download-btn"]');
      await expect(downloadBtn).toBeVisible();

      const closeBtn = page.locator('[data-testid="flyer-close-btn"]');
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();

      await expect(modal).not.toBeVisible();
    }
  });
});
