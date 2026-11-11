import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1440, 1920, 2560] as const;
const CAPTURE_WIDTHS = new Set([360, 768, 1440, 1920]);

test("About composition stays centered, readable, and within the viewport", async ({ browser }) => {
  test.setTimeout(300_000);

  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        locale: locale === "ar" ? "ar-MA" : "en-US",
        viewport: { width: 360, height: 900 },
      });
      await context.addInitScript(({ localeValue, themeValue }) => {
        localStorage.setItem("ihyaa-locale", localeValue);
        localStorage.setItem("ihyaa-theme", themeValue);
      }, { localeValue: locale, themeValue: theme });
      try {
        const page = await context.newPage();
        await page.goto("/", { waitUntil: "networkidle" });
        const about = page.locator("#about");
        await expect(about).toBeVisible();
        await expect(about.locator("article")).toHaveCount(3);
        await expect(about.locator("blockquote")).toBeVisible();
        await expect(about.locator("img")).toBeVisible();
        const activeFooterBranchCount = await page.locator("footer ul").nth(1).locator("li").count();

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 1000 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          const layout = await about.evaluate((section) => {
            const image = section.querySelector("img")!.getBoundingClientRect();
            const cards = [...section.querySelectorAll("article")].map((card) => card.getBoundingClientRect());
            const stat = section.querySelector(".tabular-nums")!.textContent?.trim();
            return {
              image: { left: image.left, right: image.right, width: image.width },
              cards: cards.map(({ left, right }) => ({ left, right })),
              stat,
              clipPath: getComputedStyle(section.querySelector("img")!.parentElement!).clipPath,
            };
          });
          expect(layout.stat).toBe(new Intl.NumberFormat(locale).format(activeFooterBranchCount));
          expect(layout.clipPath).toContain("url(");
          if (width >= 1440) {
            if (locale === "ar") {
              expect(layout.cards[0]!.left).toBeGreaterThan(layout.image.right);
              expect(layout.cards[2]!.right).toBeLessThan(layout.image.left);
            } else {
              expect(layout.cards[0]!.right).toBeLessThan(layout.image.left);
              expect(layout.cards[2]!.left).toBeGreaterThan(layout.image.right);
            }
          }
          if (CAPTURE_WIDTHS.has(width)) {
            await about.screenshot({
              path: `evidence/task-07/t4/about-${width}-${theme}-${locale}.png`,
              animations: "disabled",
            });
          }
        }
      } finally {
        await context.close();
      }
    }
  }
});
