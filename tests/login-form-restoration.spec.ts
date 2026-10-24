import { test, expect } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"];
const VIEWPORTS = [
  { name: "mobile", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

test.describe("Task 2: Login Form Restoration Across Viewports & Themes", () => {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`verifies login form width and layout in ${theme} at ${vp.name} (${vp.width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/login");
        await page.waitForLoadState("domcontentloaded");

        // Apply theme
        await page.evaluate((t) => {
          document.documentElement.classList.remove("dark");
          if (t === "amoled" || t === "black") {
            document.documentElement.classList.add("dark");
          }
          document.documentElement.setAttribute("data-theme", t);
        }, theme);

        const loginCard = page.locator('[data-testid="login-view"]');
        await expect(loginCard).toBeVisible();

        const box = await loginCard.boundingBox();
        expect(box).toBeTruthy();

        if (box) {
          // On desktop (1440px), the restored max-w-5xl form card is at least 900px wide
          if (vp.width === 1440) {
            expect(box.width).toBeGreaterThanOrEqual(900);
            // Verify 2-column layout (side banner is visible)
            const banner = loginCard.locator("img[alt='Ihyaa Program']");
            await expect(banner).toBeVisible();
          } else if (vp.width === 768) {
            // Tablet: takes good responsive proportion
            expect(box.width).toBeGreaterThanOrEqual(500);
          } else {
            // Mobile (360px): occupies mobile viewport width comfortably
            expect(box.width).toBeGreaterThanOrEqual(300);
          }
        }
      });
    }
  }

  test("signup page layout remains full-width and responsive", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    const signupCard = page.locator('[data-testid="signup-view"]');
    await expect(signupCard).toBeVisible();
    const box = await signupCard.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(900);
    }
  });
});
