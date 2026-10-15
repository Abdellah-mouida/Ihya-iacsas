import { test, expect } from "@playwright/test";

test.describe("Task 5: Creative 404 & 403 Error Pages", () => {
  test("1. 404 page renders creative illustration, youth/travel humor, and CTAs in Arabic and English", async ({
    page,
  }) => {
    // Navigate to a non-existent URL
    const response = await page.goto("/non-existent-mountain-trail-999");
    expect(response?.status()).toBe(404);

    const notFoundContainer = page.locator('[data-testid="page-not-found"]');
    await expect(notFoundContainer).toBeVisible();

    // Verify Arabic copy
    const title = page.locator('[data-testid="error-title"]');
    await expect(title).toHaveText("مسار خارج الخريطة!");

    const humor = page.locator('[data-testid="error-humor"]');
    await expect(humor).toContainText("يبدو أنك سلكت مساراً غير محدد في خريطتنا الجبلية");

    // Verify action buttons
    const homeBtn = page.locator('[data-testid="error-home-btn"]');
    await expect(homeBtn).toBeVisible();

    const eventsBtn = page.locator('[data-testid="error-events-btn"]');
    await expect(eventsBtn).toBeVisible();

    const contactBtn = page.locator('[data-testid="error-contact-btn"]');
    await expect(contactBtn).toBeVisible();

    // Switch to English (toggle button)
    const langBtn = page.locator('[data-testid="language-switcher-btn"]');
    await langBtn.click();

    // Verify English copy
    await expect(title).toHaveText("Off the Map!");
    await expect(humor).toContainText("unmarked trail on our mountain hike");
  });

  test("2. 404 page is responsive and doesn't overflow horizontally on small screens (320px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto("/non-existent-trail-320");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("3. 403 Forbidden page renders organizers tent illustration, humor, and switch account button", async ({
    page,
  }) => {
    await page.goto("/403");

    const forbiddenContainer = page.locator('[data-testid="page-forbidden"]');
    await expect(forbiddenContainer).toBeVisible();

    // Verify Arabic copy
    const title = page.locator('[data-testid="error-title"]');
    await expect(title).toHaveText("منطقة خاصة بفريق التنظيم!");

    const humor = page.locator('[data-testid="error-humor"]');
    await expect(humor).toContainText("خيمة اللجنة المنظمة");

    // Verify action buttons
    const homeBtn = page.locator('[data-testid="error-home-btn"]');
    await expect(homeBtn).toBeVisible();

    const accountBtn = page.locator('[data-testid="error-account-btn"]');
    await expect(accountBtn).toBeVisible();

    const switchBtn = page.locator('[data-testid="error-switch-btn"]');
    await expect(switchBtn).toBeVisible();

    // Switch to English (toggle button)
    const langBtn = page.locator('[data-testid="language-switcher-btn"]');
    await langBtn.click();

    await expect(title).toHaveText("Organizers Tent Only!");
    await expect(humor).toContainText("organizers' tent without a backstage pass");
  });

  test("4. 403 page is responsive and doesn't overflow horizontally on small screens (320px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto("/403");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
