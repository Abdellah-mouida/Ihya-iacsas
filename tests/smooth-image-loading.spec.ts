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
  const frame = page.locator('[data-testid="hero-photo-frame"] [data-testid="smooth-image-frame"]');
  const skeleton = frame.locator('[data-testid="smooth-image-skeleton"]');
  const image = frame.locator('[data-testid="smooth-image"]');
  await expect(skeleton).toBeVisible({ timeout: 15_000 });
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
    const image = document.querySelector('[data-testid="hero-photo-frame"] [data-testid="smooth-image"]') as HTMLImageElement;
    return getComputedStyle(image).opacity;
  })).toBe("1");
  expect(await page.evaluate(() => (window as unknown as Window & { __smoothImageCls: number }).__smoothImageCls)).toBe(0);
  expect(consoleErrors).toEqual([]);
});
