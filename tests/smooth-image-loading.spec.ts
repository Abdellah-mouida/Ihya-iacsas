import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("image skeleton reserves its frame and reveals after the image decodes without shifting layout", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.addInitScript(() => {
    let value = 0;
    Object.defineProperty(window, "__smoothImageCls", { get: () => value });
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] })[]) {
        if (!entry.hadRecentInput && entry.sources?.some(({ node }) => node instanceof Element && node.closest("[data-testid=\"smooth-image-frame\"]"))) value += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.route("**/_next/image**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#about").scrollIntoViewIfNeeded();
  const frame = page.locator('#about [data-testid="smooth-image-frame"]').first();
  const skeleton = frame.locator('[data-testid="smooth-image-skeleton"]');
  const image = frame.locator('[data-testid="smooth-image"]');
  await expect(skeleton).toBeVisible({ timeout: 15_000 });
  const icon = skeleton.locator("span").first();
  await expect(icon).toBeVisible();
  expect(await icon.evaluate((node) => getComputedStyle(node).animationName)).toContain("smooth-image-icon-float");

  const tileMeasurements = await page.evaluate((sizes) => {
    const sourceFrame = document.querySelector('#about [data-testid="smooth-image-frame"]');
    const sourceSkeleton = sourceFrame?.querySelector('[data-testid="smooth-image-skeleton"]');
    if (!sourceFrame || !sourceSkeleton) throw new Error("A visible smooth-image skeleton is required for sizing checks");
    const sandbox = document.createElement("div");
    sandbox.style.cssText = "position:fixed;left:-10000px;top:0;display:flex;align-items:flex-start;visibility:hidden;pointer-events:none;";
    document.body.append(sandbox);

    const results = sizes.map((size) => {
      const tile = sourceFrame.cloneNode(false) as HTMLElement;
      tile.style.position = "relative";
      tile.style.inset = "auto";
      tile.style.width = `${size}px`;
      tile.style.height = `${size}px`;
      tile.style.flex = "0 0 auto";
      const skeleton = sourceSkeleton.cloneNode(true) as HTMLElement;
      skeleton.style.transitionDuration = "0ms";
      tile.append(skeleton);
      sandbox.append(tile);

      const tileRect = tile.getBoundingClientRect();
      const iconElement = skeleton.querySelector("span") as HTMLElement | null;
      if (!iconElement) throw new Error("Smooth-image skeleton icon is missing");
      const iconRect = iconElement.getBoundingClientRect();
      return {
        size,
        iconWidth: Number.parseFloat(getComputedStyle(iconElement).width),
        centerDeltaX: Math.abs((tileRect.left + tileRect.right) / 2 - (iconRect.left + iconRect.right) / 2),
        centerDeltaY: Math.abs((tileRect.top + tileRect.bottom) / 2 - (iconRect.top + iconRect.bottom) / 2),
        overflow: iconRect.left < tileRect.left || iconRect.top < tileRect.top || iconRect.right > tileRect.right || iconRect.bottom > tileRect.bottom,
      };
    });

    sandbox.remove();
    return results;
  }, [24, 40, 80, 160, 320, 640]);
  for (const measurement of tileMeasurements) {
    const expectedIconSize = measurement.size <= 40 ? 12 : measurement.size === 80 ? 24 : 44;
    expect(measurement.iconWidth, `icon width in ${measurement.size}px tile`).toBeCloseTo(expectedIconSize, 0);
    expect(measurement.centerDeltaX, `horizontal center in ${measurement.size}px tile`).toBeLessThanOrEqual(1);
    expect(measurement.centerDeltaY, `vertical center in ${measurement.size}px tile`).toBeLessThanOrEqual(1);
    expect(measurement.overflow, `icon must fit in ${measurement.size}px tile`).toBe(false);
  }

  fs.mkdirSync("evidence/task-08/t5", { recursive: true });
  await page.screenshot({ path: "evidence/task-08/t5/smooth-image-skeleton.png" });
  const before = await frame.boundingBox();
  expect(before).not.toBeNull();
  await expect(image).toHaveAttribute("data-testid", "smooth-image");
  await expect.poll(async () => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
  await expect(skeleton).toHaveCount(0, { timeout: 3_000 });
  await page.screenshot({ path: "evidence/task-08/t5/smooth-image-revealed.png" });
  const after = await frame.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(0.5);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => {
    const image = document.querySelector('#about [data-testid="smooth-image"]') as HTMLImageElement;
    return getComputedStyle(image).opacity;
  })).toBe("1");
  expect(await page.evaluate(() => (window as unknown as Window & { __smoothImageCls: number }).__smoothImageCls)).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("skeleton icon is static when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route(/logo-circle\.png/, (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("#about").scrollIntoViewIfNeeded();
  const skeleton = page.locator('#about [data-testid="smooth-image-skeleton"]').first();
  await expect(skeleton).toBeVisible({ timeout: 15_000 });
  const animationName = await skeleton.locator("span").first().evaluate((node) => getComputedStyle(node).animationName);
  expect(animationName).toBe("none");
});
