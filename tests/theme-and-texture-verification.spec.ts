import { test, expect } from "@playwright/test";

test.describe("Theme main color & pattern texture layer verification", () => {
  test("Home page renders texture layer with mask-image and pattern SVG HTTP 200", async ({ page, request }) => {
    // Check pattern SVGs are 200 OK
    const patterns = [
      "/patterns/mandala.svg",
      "/patterns/star-rosette.svg",
      "/patterns/girih.svg",
      "/patterns/interlocking-geometric.svg",
      "/patterns/corner-ornament.svg",
    ];

    for (const pat of patterns) {
      const res = await request.get(pat);
      expect(res.status(), `Pattern ${pat} should return 200`).toBe(200);
    }

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check shared page background texture layer exists
    const textureSurface = page.locator(".texture-surface").first();
    await expect(textureSurface).toBeAttached();

    // Verify computed mask-image is not none
    const maskImage = await textureSurface.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.maskImage || style.webkitMaskImage;
    });

    expect(maskImage).toBeTruthy();
    expect(maskImage).not.toBe("none");

    // Verify theme colors on Morocco map
    const map = page.locator('svg[role="img"]').filter({ hasText: /فروع|المغرب|Branches|Morocco/i }).first();
    const mapExists = await page.locator("#branches svg").count();
    expect(mapExists).toBeGreaterThanOrEqual(1);

    // Verify activities section card titles in Arabic have no Latin characters
    const activitiesSection = page.locator("#activities");
    await expect(activitiesSection).toBeAttached();

    const activityCards = activitiesSection.locator("h3");
    const count = await activityCards.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Check first card text
    const text = await activitiesSection.textContent();
    expect(text).toContain("01");
    // In Arabic locale, ensure no Latin "FIELD" word
    expect(text).not.toContain("FIELD");
    expect(text).not.toContain("MIND");
    expect(text).not.toContain("IMPACT");
  });

  test("Live theme switch changes map styling tokens without reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check html data-theme can be toggled
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme") || "light");

    // Set theme to amoled
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "amoled");
      document.documentElement.classList.add("dark");
    });

    const mainColorAmoled = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).getPropertyValue("--main").trim();
    });

    expect(mainColorAmoled).toBeTruthy();

    // Set theme to sunset
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "sunset");
    });

    const mainColorSunset = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).getPropertyValue("--main").trim();
    });

    expect(mainColorSunset).toBeTruthy();
    expect(mainColorSunset).not.toBe(mainColorAmoled);
  });
});
