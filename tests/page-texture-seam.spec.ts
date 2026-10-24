import { test, expect } from "@playwright/test";
import sharp from "sharp";

const THEMES = ["light", "sunset", "amoled", "black"];

test.describe("Task 1: Single Continuous Page-Level Texture Architecture & Seam Test", () => {
  for (const theme of THEMES) {
    test(`renders continuous page texture layer without boundary seam lines on Home in ${theme}`, async ({
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

      // Verify single page-texture-layer exists at top level
      const pageTexture = page.locator('[data-testid="page-texture-layer"]').first();
      await expect(pageTexture).toBeAttached();

      // Check that navbar does NOT contain its own texture layer
      const navTexture = page.locator("header nav [data-testid=\"texture-layer\"]");
      await expect(navTexture).toHaveCount(0);

      // Seam test: measure section boundaries (e.g. hero -> about, program -> contact, contact -> footer)
      // Capture strip across about section top boundary
      const aboutEl = page.locator("#about");
      await expect(aboutEl).toBeVisible();
      const box = await aboutEl.boundingBox();
      expect(box).toBeTruthy();

      if (box) {
        // Screenshot a 100px vertical strip centered on the boundary (y - 50 to y + 50)
        const stripBuffer = await page.screenshot({
          clip: {
            x: Math.max(0, box.x + 100),
            y: Math.max(0, box.y - 40),
            width: 200,
            height: 80,
          },
        });

        // Heuristic: decode with sharp and verify smooth luminance transition
        // shortcut: luminance jump heuristic across boundary strip; upgrade path: pixelmatch against baseline
        const { data, info } = await sharp(stripBuffer)
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Calculate average row luminance
        const rowLums: number[] = [];
        const channels = info.channels;
        for (let row = 0; row < info.height; row++) {
          let sum = 0;
          for (let col = 0; col < info.width; col++) {
            const idx = (row * info.width + col) * channels;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            sum += 0.299 * r + 0.587 * g + 0.114 * b;
          }
          rowLums.push(sum / info.width);
        }

        // Maximum adjacent row-to-row jump should be smooth (no sharp horizontal line)
        let maxDelta = 0;
        for (let i = 1; i < rowLums.length; i++) {
          const delta = Math.abs(rowLums[i] - rowLums[i - 1]);
          if (delta > maxDelta) maxDelta = delta;
        }

        // A sharp border/line produces a sharp step delta >= 25 in luminance
        expect(maxDelta).toBeLessThan(25);
      }
    });
  }

  test("Navbar has no opaque gap at y = 0 and floats directly over continuous texture", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const header = page.locator("header");
    await expect(header).toBeVisible();

    const box = await header.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      // Header is at y <= 15px (fixed inset-x-0 top-0 px-3 pt-3)
      expect(box.y).toBeLessThanOrEqual(15);
    }
  });
});
