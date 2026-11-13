import fs from "node:fs";
import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [360, 768, 1440] as const;

test("the gallery DriftWall keeps its top title, borderless random layout, modal and responsiveness across themes and locales", async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync("evidence/task-07/t8/gallery", { recursive: true });

  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        locale: locale === "ar" ? "ar-MA" : "en-US",
        viewport: { width: 360, height: 900 },
      });
      await context.addInitScript(({ localeValue, themeValue }) => {
        localStorage.setItem("ihyaa-locale", localeValue);
        localStorage.setItem("ihyaa-theme", themeValue);
        document.cookie = `ihyaa-theme=${themeValue}; path=/`;
      }, { localeValue: locale, themeValue: theme });
      const page = await context.newPage();
      try {
        await page.goto("/gallery", { waitUntil: "domcontentloaded" });
        await expect(page.locator("main h2").first()).toBeVisible({ timeout: 30_000 });
        const wall = page.locator('[data-rb="DriftWall"]');
        await expect(wall).toBeVisible({ timeout: 30_000 });
        expect(await wall.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("0px");

        const cards = wall.locator("[data-gallery-card]");
        await expect(cards.first()).toBeVisible({ timeout: 30_000 });
        const tileCount = await cards.count();
        expect(tileCount).toBeGreaterThan(0);

        const firstTile = cards.first();
        await expect(firstTile.locator("img")).toHaveAttribute("alt", /.+/);
        await expect(firstTile).toHaveAttribute("aria-label", /.+/);
        const uniquePhotos = await cards.evaluateAll((els) => new Set(els.map((el) => el.getAttribute("aria-label"))).size);
        expect(uniquePhotos).toBeGreaterThan(0);

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          await expect.poll(() => page.evaluate(() => {
            const visibleImages = Array.from(document.querySelectorAll<HTMLImageElement>("[data-gallery-card] img"))
              .filter((item) => {
                const bounds = item.getBoundingClientRect();
                return bounds.width > 0 && bounds.height > 0 && bounds.top < window.innerHeight && bounds.bottom > 0 && bounds.left < window.innerWidth && bounds.right > 0;
              });
            return visibleImages.length > 0 && visibleImages.some((item) => item.complete && item.naturalWidth > 0);
          }), { timeout: 20_000, intervals: [250, 500, 1000] }).toBe(true);
          await page.screenshot({ path: `evidence/task-07/t8/gallery/gallery-${width}-${theme}-${locale}.png` });
        }

        const clickableTile = await wall.evaluate((wallEl) => {
          const wr = wallEl.getBoundingClientRect();
          const els = Array.from(wallEl.querySelectorAll("[data-gallery-card]"));
          const match = els.find((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width > 20 &&
              r.height > 20 &&
              r.left >= Math.max(0, wr.left + 8) &&
              r.right <= Math.min(window.innerWidth, wr.right - 8) &&
              r.top >= Math.max(0, wr.top + 32) &&
              r.bottom <= Math.min(window.innerHeight, wr.bottom - 32)
            );
          });
          return match?.getAttribute("data-tile-id") ?? null;
        });
        expect(clickableTile).toBeTruthy();
        await wall.locator(`[data-tile-id="${clickableTile}"]`).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("img")).toHaveAttribute("alt", /.+/);
        await expect(dialog.getByRole("button", { name: locale === "ar" ? "إغلاق" : "Close" })).toBeVisible();
        if (uniquePhotos > 1) {
          const nextBtn = dialog.getByRole("button", { name: locale === "ar" ? "الصورة التالية" : "Next image" });
          await expect(nextBtn).toBeVisible();
          await nextBtn.click();
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      } finally {
        await context.close();
      }
    }
  }
});

test("the home gallery preview uses localized MorphSlider controls without a legacy dialog", async ({ browser }) => {
  for (const locale of LOCALES) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-MA" : "en-US",
      viewport: { width: 360, height: 900 },
    });
    await context.addInitScript((localeValue) => {
      localStorage.setItem("ihyaa-locale", localeValue);
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-theme=light; path=/";
    }, locale);
    const page = await context.newPage();
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const gallery = page.locator("main #gallery");
      await expect(gallery).toBeVisible({ timeout: 30_000 });
      await gallery.evaluate((element) => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top, behavior: "instant" }));
      const slider = gallery.locator('[data-rb="MorphSlider"]');
      await expect(slider).toBeVisible({ timeout: 30_000 });
      await expect(slider.locator(".morph-slider-caption")).toBeHidden();
      await page.setViewportSize({ width: 768, height: 900 });
      await expect(slider.locator(".morph-slider-caption")).toBeVisible();
      const prevBtn = slider.getByRole("button", { name: locale === "ar" ? "الشريحة السابقة" : "Previous slide" });
      const nextBtn = slider.getByRole("button", { name: locale === "ar" ? "الشريحة التالية" : "Next slide" });
      await expect(prevBtn).toBeVisible();
      await expect(nextBtn).toBeVisible();
      const secondDot = slider.getByRole("tab").nth(1);
      await expect(slider.getByRole("tab").nth(0)).toHaveAttribute("aria-selected", "true");
      await nextBtn.click();
      await expect(secondDot).toHaveAttribute("aria-selected", "true");
      await slider.locator(".morph-slider-stage").click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});
