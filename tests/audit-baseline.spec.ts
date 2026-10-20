import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

test.describe("Baseline Audit Evidence", () => {
  test.beforeAll(() => {
    fs.mkdirSync("test-results/baseline", { recursive: true });
  });

  test("Check home textures and background", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/baseline/home.png", fullPage: false });
    
    // Evaluate if texture layer exists and has mask-image
    const textureInfo = await page.evaluate(() => {
      const el = document.querySelector(".bg-texture, .page-background, [data-testid='page-background']");
      if (!el) return { found: false };
      const comp = window.getComputedStyle(el);
      return {
        found: true,
        maskImage: comp.maskImage || comp.webkitMaskImage,
        backgroundImage: comp.backgroundImage,
        opacity: comp.opacity,
        display: comp.display
      };
    });
    console.log("HOME TEXTURE INFO:", JSON.stringify(textureInfo));
  });

  test("Check login page background and textures", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/baseline/login.png" });
    const textureInfo = await page.evaluate(() => {
      const el = document.querySelector(".bg-texture, .page-background, [data-testid='page-background'], .pattern-girih");
      if (!el) return { found: false };
      const comp = window.getComputedStyle(el);
      return {
        found: true,
        maskImage: comp.maskImage || comp.webkitMaskImage,
        backgroundImage: comp.backgroundImage,
        opacity: comp.opacity
      };
    });
    console.log("LOGIN TEXTURE INFO:", JSON.stringify(textureInfo));
  });

  test("Check signup page background and textures", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "test-results/baseline/signup.png" });
  });

  test("Check /settings and /profile routes", async ({ page }) => {
    const resSettings = await page.goto("/settings");
    console.log("SETTINGS URL AFTER GOTO:", page.url(), "STATUS:", resSettings?.status());
    await page.screenshot({ path: "test-results/baseline/settings.png" });

    const resProfile = await page.goto("/profile");
    console.log("PROFILE URL AFTER GOTO:", page.url(), "STATUS:", resProfile?.status());
    await page.screenshot({ path: "test-results/baseline/profile.png" });
  });
});
