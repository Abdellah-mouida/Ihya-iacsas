import { test, expect } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"];

test.describe("Task 2: Navbar Transparent at Top & Background After Scrolling Across Every Page", () => {
  for (const theme of THEMES) {
    test(`navbar on / and /events has transparent background at top and glass after scroll in ${theme}`, async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      // Apply theme
      await page.evaluate((t) => {
        document.documentElement.classList.remove("dark");
        if (t === "amoled" || t === "black") {
          document.documentElement.classList.add("dark");
        }
        document.documentElement.setAttribute("data-theme", t);
      }, theme);

      const nav = page.locator("header nav");
      await expect(nav).toBeVisible();

      // Top state on /: transparentTop should be true
      const topClasses = await nav.first().getAttribute("class");
      expect(topClasses).toContain("bg-transparent");
      expect(topClasses).toContain("border-transparent");

      // Scroll down 300px (past 200px sentinel)
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(300);

      // Scrolled state on /: should have glass background
      const scrolledClasses = await nav.first().getAttribute("class");
      expect(scrolledClasses).not.toContain("bg-transparent");
      expect(scrolledClasses).toContain("shadow-layered");

      // Now verify on /events (content page)
      await page.goto("/events");
      await page.waitForLoadState("domcontentloaded");

      // Top state on /events: should also be transparent at top!
      const eventsNav = page.locator("header nav").first();
      await expect(eventsNav).toBeVisible();
      const eventsTopClasses = await eventsNav.getAttribute("class");
      expect(eventsTopClasses).toContain("bg-transparent");

      // Scroll down on /events
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(300);

      const eventsScrolledClasses = await eventsNav.getAttribute("class");
      expect(eventsScrolledClasses).not.toContain("bg-transparent");
      expect(eventsScrolledClasses).toContain("shadow-layered");
    });
  }
});
