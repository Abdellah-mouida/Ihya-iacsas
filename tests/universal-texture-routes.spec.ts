import { test, expect } from "@playwright/test";

const ROUTES_TO_TEST = [
  { path: "/", testId: "home" },
  { path: "/login", testId: "login" },
  { path: "/signup", testId: "signup" },
  { path: "/events", testId: "events" },
  { path: "/gallery", testId: "gallery" },
  { path: "/book", testId: "book" },
  { path: "/403", testId: "403" },
];

const THEMES = ["light", "sunset", "amoled", "black"];

test.describe("Task 3: Universal Texture Integration Across Routes and Themes", () => {
  for (const route of ROUTES_TO_TEST) {
    test(`renders active Texture layer on ${route.path} across themes`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("domcontentloaded");

      // Verify that at least one Texture layer is attached on the page
      const textureLayer = page.locator('[data-testid="texture-layer"]').first();
      await expect(textureLayer).toBeAttached({ timeout: 5000 });

      // Check SVG pattern element inside
      const svgEl = textureLayer.locator("svg");
      await expect(svgEl).toBeAttached();

      // Check pattern image href
      const imgHref = await textureLayer.locator("image").getAttribute("href");
      expect(imgHref).toMatch(/^\/patterns\/[a-z0-9-]+\.svg$/);

      // Verify each theme applies without crashing
      for (const theme of THEMES) {
        await page.evaluate((t) => {
          document.documentElement.classList.remove("dark");
          if (t === "amoled" || t === "black") {
            document.documentElement.classList.add("dark");
          }
          document.documentElement.setAttribute("data-theme", t);
        }, theme);

        const mainColor = await page.evaluate(() => {
          return window.getComputedStyle(document.documentElement).getPropertyValue("--main").trim();
        });
        expect(mainColor).toBeTruthy();
      }
    });
  }
});
