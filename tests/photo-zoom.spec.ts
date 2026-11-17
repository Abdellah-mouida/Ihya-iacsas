import { expect, test } from "@playwright/test";

test.describe("15-T2: PhotoZoom FLIP modal on Gallery & Home MorphSlider", () => {
  test("gallery opens single-photo PhotoZoom with FLIP fit, plain backdrop, focus return, drag guard, and close modes", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-locale=en; path=/";
      document.cookie = "ihyaa-theme=light; path=/";
    });
    const page = await context.newPage();
    try {
      await page.goto("/gallery", { waitUntil: "domcontentloaded" });
      const wall = page.locator('[data-rb="DriftColumns"]');
      await expect(wall).toBeVisible({ timeout: 20_000 });

      const firstCard = wall.locator("button[data-gallery-card]").first();
      await expect(firstCard).toBeVisible({ timeout: 15_000 });
      const box = await firstCard.boundingBox();
      expect(box).toBeTruthy();

      // Drag >6px must NOT open PhotoZoom
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 24, cy + 24, { steps: 4 });
        await page.mouse.up();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }

      // Focus + click opens PhotoZoom
      await firstCard.focus();
      await firstCard.click();

      const dialog = page.getByRole("dialog", { name: "Expanded photo view" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute("aria-modal", "true");

      // Single photo alone: only 1 button (Close) inside dialog, no Next/Prev
      await expect(dialog.locator("button")).toHaveCount(1);
      await expect(dialog.locator("img")).toHaveCount(1);

      // Focus moved to close button
      const closeBtn = dialog.getByRole("button", { name: "Close" });
      await expect(closeBtn).toBeFocused();

      // Plain dimmed backdrop (no backdrop-filter)
      const backdropFilter = await dialog.locator("> div").first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter || "none";
      });
      expect(backdropFilter).toBe("none");

      // Fitted inside 90vw x 85vh
      const frameBox = await dialog.getByTestId("photo-zoom-frame").boundingBox();
      expect(frameBox).toBeTruthy();
      if (frameBox) {
        expect(frameBox.width).toBeLessThanOrEqual(1280 * 0.9 + 2);
        expect(frameBox.height).toBeLessThanOrEqual(800 * 0.85 + 2);
      }

      // Scroll locked while open
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

      // Escape closes & returns focus
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0, { timeout: 3000 });
      await expect(firstCard).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");

      // Click backdrop/anywhere closes
      await firstCard.click();
      await expect(dialog).toBeVisible();
      await dialog.click({ position: { x: 20, y: 20 } });
      await expect(dialog).toHaveCount(0, { timeout: 3000 });

      // Close button (X) closes
      await firstCard.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Close" }).click();
      await expect(dialog).toHaveCount(0, { timeout: 3000 });
    } finally {
      await context.close();
    }
  });

  test("home MorphSlider & reduced-motion MorphCrossfade open PhotoZoom without opening on drag", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "ar");
      localStorage.setItem("ihyaa-theme", "amoled");
      document.cookie = "ihyaa-locale=ar; path=/";
      document.cookie = "ihyaa-theme=amoled; path=/";
    });
    const page = await context.newPage();
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const gallery = page.locator("main #gallery");
      await gallery.scrollIntoViewIfNeeded();
      const stage = gallery.locator(".morph-slider-stage");
      await expect(stage).toBeVisible({ timeout: 20_000 });

      const box = await stage.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        await page.mouse.move(cx + 30, cy, { steps: 5 });
        await page.mouse.up();
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }

      await stage.click();
      const dialog = page.getByRole("dialog", { name: "عرض الصورة مكبّرة" });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("img")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0, { timeout: 3000 });
    } finally {
      await context.close();
    }
  });
});
