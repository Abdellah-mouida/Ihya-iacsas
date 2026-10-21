import { test, expect } from "@playwright/test";

test.describe("Task 1: Universal Texture and Pattern Verification", () => {
  test("homepage renders shared PageBackground with computed mask-image and pattern asset 200 OK", async ({
    page,
  }) => {
    // Monitor network requests for patterns
    const patternRequests: string[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/patterns/")) {
        expect(res.status()).toBe(200);
        patternRequests.push(url);
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Assert PageBackground container exists
    const bg = page.locator('[data-testid="page-background"]');
    await expect(bg).toBeVisible();

    // Assert Texture layer exists and has computed mask-image set
    const texture = page.locator('[data-testid="page-texture-layer"]');
    await expect(texture).toBeAttached();

    const computedMask = await texture.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.maskImage || style.webkitMaskImage || "";
    });

    expect(computedMask).toContain("girih.svg");

    // Check SVG pattern request loaded cleanly
    const girihReq = patternRequests.some((url) => url.includes("girih.svg"));
    expect(girihReq).toBe(true);
  });

  test("auth pages render theme-reactive auth texture with pattern mask", async ({
    page,
  }) => {
    let patternStatus = 0;
    page.on("response", (res) => {
      if (res.url().includes("octagon-tile.svg") || res.url().includes("star-rosette.svg")) {
        patternStatus = res.status();
      }
    });

    await page.goto("/login", { waitUntil: "networkidle" });

    const backdrop = page.locator('[data-testid="auth-ambient-backdrop"]');
    await expect(backdrop).toBeAttached();

    const authTexture = backdrop.locator(".texture-surface");
    await expect(authTexture).toBeAttached();

    const computedMask = await authTexture.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.maskImage || style.webkitMaskImage || "";
    });

    expect(computedMask).toContain("octagon-tile.svg");
    expect(patternStatus).toBe(200);
  });
});
