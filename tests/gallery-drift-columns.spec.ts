import { expect, test } from "@playwright/test";
import { distributeGalleryColumns } from "../src/lib/gallery-distribution";

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `photo-${i}` }));
}

test.describe("15-T1: Gallery DriftColumns distribution & UI", () => {
  test("distributeGalleryColumns enforces non-adjacency, seam safety, and repeat spacing for 3, 5, 12, and 60 photos", () => {
    for (const count of [3, 5, 12, 60]) {
      const items = makeItems(count);
      for (const colCount of [2, 3, 4, 5]) {
        for (const seed of [1, 7, 42, 999]) {
          const cols = distributeGalleryColumns(items, colCount, seed);
          expect(cols).toHaveLength(colCount);

          // Same seed must be deterministic
          expect(distributeGalleryColumns(items, colCount, seed)).toEqual(cols);

          // Same-column & seam adjacency check
          for (let c = 0; c < cols.length; c++) {
            const col = cols[c];
            expect(col.length).toBeGreaterThanOrEqual(6);
            for (let r = 0; r < col.length; r++) {
              const nextR = (r + 1) % col.length;
              expect(col[r].id).not.toBe(col[nextR].id);
            }
          }

          // Neighbor-column same-row check
          for (let c = 0; c < cols.length - 1; c++) {
            const minLen = Math.min(cols[c].length, cols[c + 1].length);
            for (let r = 0; r < minLen; r++) {
              expect(cols[c][r].id).not.toBe(cols[c + 1][r].id);
            }
          }

          // Every photo must appear at least once
          const allIds = cols.flat().map((x) => x.id);
          for (const item of items) {
            expect(allIds).toContain(item.id);
          }

          // 60 photos must have zero duplicates
          if (count === 60) {
            expect(new Set(allIds).size).toBe(60);
            expect(allIds.length).toBe(60);
          }

          // Repeats within the same column must be spaced (>= 2 rows apart) when count >= 3
          if (count >= 3 && count < colCount * 6) {
            for (const col of cols) {
              const seenRows = new Map<string, number[]>();
              col.forEach((item, row) => {
                const list = seenRows.get(item.id) ?? [];
                list.push(row);
                seenRows.set(item.id, list);
              });
              for (const rows of seenRows.values()) {
                for (let i = 0; i < rows.length; i++) {
                  for (let j = i + 1; j < rows.length; j++) {
                    const diff = Math.abs(rows[i] - rows[j]);
                    const circular = Math.min(diff, col.length - diff);
                    expect(circular).toBeGreaterThanOrEqual(2);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  test("gallery renders alternating drifting columns, pauses on hover/focus/offscreen, and falls back to static masonry", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "amoled");
      document.cookie = "ihyaa-locale=en; path=/";
      document.cookie = "ihyaa-theme=amoled; path=/";
    });

    const page = await context.newPage();
    try {
      await page.goto("/gallery", { waitUntil: "domcontentloaded" });
      const wall = page.locator('[data-rb="DriftColumns"]');
      await expect(wall).toBeVisible({ timeout: 20_000 });
      await expect(wall.locator('[data-testid="gallery-drifting-viewport"]')).toBeVisible({
        timeout: 15_000,
      });

      // Desktop 1440px -> 5 columns alternating up/down with 40-70s durations
      const colInfo = await wall.locator(".drift-columns__col").evaluateAll((els) =>
        els.map((el) => ({
          dir: el.getAttribute("data-col-direction"),
          dur: Number(el.getAttribute("data-col-duration")),
        })),
      );
      expect(colInfo.length).toBeGreaterThanOrEqual(4);
      colInfo.forEach((info, idx) => {
        expect(info.dir).toBe(idx % 2 === 0 ? "up" : "down");
        expect(info.dur).toBeGreaterThanOrEqual(40);
        expect(info.dur).toBeLessThanOrEqual(70);
      });

      // Hover pauses animation
      await wall.hover();
      const hoverPlayState = await wall
        .locator(".drift-columns__track")
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState);
      expect(hoverPlayState).toBe("paused");

      // Move pointer away and focus a card -> focus-within pauses animation
      await page.mouse.move(0, 0);
      await wall.locator("button[data-gallery-card]").first().focus();
      const focusPlayState = await wall
        .locator(".drift-columns__track")
        .first()
        .evaluate((el) => getComputedStyle(el).animationPlayState);
      expect(focusPlayState).toBe("paused");

      // Tablet 768px -> 3 columns
      await page.setViewportSize({ width: 768, height: 900 });
      await expect.poll(() => wall.locator(".drift-columns__col").count()).toBe(3);

      // Phone 360px & 320px -> 2 columns and no horizontal overflow
      for (const width of [360, 320]) {
        await page.setViewportSize({ width, height: 800 });
        await expect.poll(() => wall.locator(".drift-columns__col").count()).toBe(2);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(overflow).toBe(false);
      }

      // Scroll off-screen -> data-paused="true"
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(wall).toHaveAttribute("data-paused", "true");
    } finally {
      await context.close();
    }

    // Reduced motion -> static masonry grid
    const reducedCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    try {
      const page = await reducedCtx.newPage();
      await page.goto("/gallery", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="gallery-static-masonry"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator('[data-testid="gallery-drifting-viewport"]')).toHaveCount(0);
    } finally {
      await reducedCtx.close();
    }

    // Low power [data-perf="low"] -> static masonry grid
    const lowPerfCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await lowPerfCtx.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 2 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    });
    try {
      const page = await lowPerfCtx.newPage();
      await page.goto("/gallery", { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid="gallery-static-masonry"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator('[data-testid="gallery-drifting-viewport"]')).toHaveCount(0);
    } finally {
      await lowPerfCtx.close();
    }
  });
});
