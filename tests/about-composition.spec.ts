import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 480, 768, 1440, 1920, 2560] as const;
const CAPTURE_WIDTHS = new Set([360, 768, 1440, 1920]);
const ACTIVITY_COPY = {
  ar: [
    ["لقاءات", "لقاءات شبابية ومجالس تربوية."],
    ["خرجات", "خرجات ترفيهية وأنشطة رياضية."],
    ["حوارات", "نقاشات فكرية وحوارات ثقافية."],
    ["تكوين", "دورات تكوينية وورشات تدريبية."],
  ],
  en: [
    ["Gatherings", "Youth gatherings and educational circles."],
    ["Outings", "Recreational outings and sports activities."],
    ["Dialogues", "Intellectual discussions and cultural dialogues."],
    ["Training", "Training courses and workshops."],
  ],
} as const;

test("About merges the activity cards around the centered logo without overflow", async ({ browser }) => {
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
        document.cookie = `ihyaa-theme=${themeValue}; path=/`;
      }, { localeValue: locale, themeValue: theme });
      try {
        const page = await context.newPage();
        await page.goto("/", { waitUntil: "networkidle" });
        const about = page.locator("#about");
        await expect(about).toBeVisible();
        await expect(page.locator("#activities")).toHaveCount(0);
        await expect(about.locator("article[data-testid='home-activity-card']")).toHaveCount(4);
        await expect(about.locator("blockquote")).toBeVisible();
        await about.locator(".tabular-nums").scrollIntoViewIfNeeded();
        const logo = about.locator("img[src*='logo-circle']");
        await expect(logo).toBeVisible();
        const cards = about.locator("article[data-testid='home-activity-card']");
        for (const [index, [title, description]] of ACTIVITY_COPY[locale].entries()) {
          await expect(cards.nth(index).locator("h3")).toHaveText(title);
          await expect(cards.nth(index).locator("p")).toHaveText(description);
          await expect(cards.nth(index).locator("> svg path")).toHaveCount(2);
        }

        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 1000 });
          await expect(about.locator(".tabular-nums")).not.toHaveText("");
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          const geometry = await about.evaluate((section) => {
            const logoBox = section.querySelector("img")!.getBoundingClientRect();
            const cardBoxes = [...section.querySelectorAll("article[data-testid='home-activity-card']")].map((node) => node.getBoundingClientRect());
            const count = section.querySelector(".tabular-nums")!.textContent?.trim();
            return { logo: { x: logoBox.x, y: logoBox.y, width: logoBox.width }, cards: cardBoxes.map(({ x, y, width }) => ({ x, y, width })), count };
          });
          expect(geometry.count).toBeTruthy();
          expect(geometry.logo.width).toBeGreaterThanOrEqual(160);
          if (width <= 480) expect(geometry.logo.y).toBeLessThan(Math.min(...geometry.cards.map((card) => card.y)));
          if (width >= 1440) {
            const logoCenter = geometry.logo.x + geometry.logo.width / 2;
            expect(geometry.cards.filter((card) => card.x + card.width / 2 < logoCenter)).toHaveLength(2);
            expect(geometry.cards.filter((card) => card.x + card.width / 2 > logoCenter)).toHaveLength(2);
          }
          if (CAPTURE_WIDTHS.has(width)) {
            await about.screenshot({ path: `evidence/task-08/t3/about-${width}-${theme}-${locale}.png`, animations: "disabled" });
          }
        }
      } finally {
        await context.close();
      }
    }
  }
});
