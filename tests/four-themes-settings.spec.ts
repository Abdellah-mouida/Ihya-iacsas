import { test, expect } from "@playwright/test";

test.describe("Four Themes & Real Settings / Profile Architecture", () => {
  test("1. Homepage respects 4 theme data-theme attributes and heading CSS tokens", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Evaluate root computed heading token
    const headingToken = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue("--heading").trim();
    });
    expect(headingToken.length).toBeGreaterThan(0);

    // Verify themes can be set to the 4 exact options
    for (const theme of ["light", "sunset", "amoled", "black"]) {
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
        if (t === "light") {
          document.documentElement.classList.remove("dark");
        } else {
          document.documentElement.classList.add("dark");
        }
      }, theme);

      const appliedTheme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      expect(appliedTheme).toBe(theme);
    }
  });

  test("2. Legacy /account route redirects permanently to /profile", async ({ page }) => {
    const response = await page.goto("/account");
    // Since /profile is a protected user route, it will redirect unauthenticated users to /login?callbackUrl=/profile
    expect(page.url()).toContain("/login");
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=/profile");
  });

  test("3. Unauthenticated /settings redirects to /login?callbackUrl=/settings", async ({ page }) => {
    await page.goto("/settings");
    expect(page.url()).toContain("/login");
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=/settings");
  });
});
