import fs from "node:fs";
import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [360, 768, 1440] as const;

test("the gallery archive keeps its images, dates, modal and layout across themes and locales", async ({ browser }) => {
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
        const cards = page.locator("[data-gallery-card]");
        await expect(cards.first()).toBeVisible({ timeout: 30_000 });
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);

        const firstCard = cards.first();
        const image = firstCard.locator("img");
        await expect(image).toHaveAttribute("alt", /.+/);
        const box = await firstCard.locator("button").boundingBox();
        expect(box).toBeTruthy();
        if (box) expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.04);
        await expect(firstCard.locator("button")).toHaveAttribute("aria-label", /.+/);
        await expect(page.locator("main h3").first()).toBeVisible();

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          await expect.poll(() => page.evaluate(() => {
            const visibleImages = Array.from(document.querySelectorAll<HTMLImageElement>("[data-gallery-card] img"))
              .filter((item) => {
                const bounds = item.getBoundingClientRect();
                return bounds.top < window.innerHeight && bounds.bottom > 0;
              });
            return visibleImages.length > 0 && visibleImages.every((item) => item.complete && item.naturalWidth > 0);
          }), { timeout: 20_000, intervals: [250, 500, 1000] }).toBe(true);
          await page.screenshot({ path: `evidence/task-07/t8/gallery/gallery-${width}-${theme}-${locale}.png` });
        }

        await firstCard.locator("button").click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("img")).toHaveAttribute("alt", /.+/);
        await expect(dialog.getByRole("button", { name: locale === "ar" ? "إغلاق" : "Close" })).toBeVisible();
        const counter = dialog.getByText(new RegExp(`^1\\s*\\/\\s*${cardCount}$`));
        await expect(counter).toBeVisible();
        if (cardCount > 1) {
          await dialog.getByRole("button", { name: locale === "ar" ? "الصورة التالية" : "Next image" }).click();
          const nextIndex = locale === "ar" ? cardCount : 2;
          await expect(dialog.getByText(new RegExp(`^${nextIndex}\\s*\\/\\s*${cardCount}$`))).toBeVisible();
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
    const context = await browser.newContext({ locale: locale === "ar" ? "ar-MA" : "en-US" });
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
