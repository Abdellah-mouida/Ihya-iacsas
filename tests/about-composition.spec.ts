import { expect, test } from "@playwright/test";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1280, 1920] as const;
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

test("About cards stay inside their wavy frames at requested widths, themes and locales", async ({ browser }) => {
  test.setTimeout(180_000);

  for (const locale of LOCALES) {
    const context = await browser.newContext({
      locale: locale === "ar" ? "ar-MA" : "en-US",
      viewport: { width: 768, height: 900 },
    });
    await context.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "ar");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-theme=light; path=/";
    });
    try {
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "domcontentloaded" });
      if (locale === "en") {
        await page.getByTestId("language-switcher-btn").click();
      }
      const about = page.locator("#about");
      const cards = about.locator("article[data-testid='home-activity-card']");
      await expect(about).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("#activities")).toHaveCount(0);
      await expect(cards).toHaveCount(4);
      await expect(about.locator("blockquote")).toHaveCount(0);
      const logo = about.locator("img[src*='logo-circle']");
      await expect(logo).toBeVisible();
      await about.scrollIntoViewIfNeeded();

      for (const [index, [title, description]] of ACTIVITY_COPY[locale].entries()) {
        await expect(cards.nth(index).locator("h3")).toHaveText(title);
        await expect(cards.nth(index).locator("p")).toHaveText(description);
        const card = cards.nth(index);
        await expect(card.locator("[data-testid=activity-content]")).toHaveCSS("text-align", "center");
        await expect(card.locator("[data-testid=activity-content]")).toHaveCSS("align-items", "center");
        await expect(card.locator("[data-testid=activity-outline] > path")).toHaveCount(2);
        const paths = await card.evaluate((node) => {
          const clipPath = node.querySelector("clipPath path")?.getAttribute("d");
          const outlinePath = node.querySelector("[data-testid=activity-outline] > path")?.getAttribute("d");
          const clipValue = getComputedStyle(node.querySelector("[data-testid=activity-surface]")!).getPropertyValue("--activity-clip");
          return { clipPath, outlinePath, clipValue };
        });
        expect(paths.clipPath).toBeTruthy();
        expect(paths.outlinePath).toBe(paths.clipPath);
        expect(paths.clipValue).toContain(await card.getAttribute("data-activity-frame"));
      }

      for (const theme of THEMES) {
        await page.evaluate((themeValue) => {
          document.documentElement.dataset.theme = themeValue;
        }, theme);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--main").trim())).not.toBe("");
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 1000 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          const geometry = await about.evaluate((section) => {
            const logoBox = section.querySelector("img")!.getBoundingClientRect();
            const cards = [...section.querySelectorAll<HTMLElement>("article[data-testid='home-activity-card']")].map((node) => {
              const frame = node.getBoundingClientRect();
              const content = node.querySelector("[data-testid=activity-content]")!.getBoundingClientRect();
              const css = getComputedStyle(node);
              const padInline = Number.parseFloat(css.paddingInlineStart);
              const padBlock = Number.parseFloat(css.paddingBlockStart);
              const requiredInline = frame.width * 0.12 + 8;
              const requiredBlock = frame.height * 0.10 + 8;
              return {
                fitsInnerFrame:
                  content.left >= frame.left + requiredInline - 1 &&
                  content.right <= frame.right - requiredInline + 1 &&
                  content.top >= frame.top + requiredBlock - 1 &&
                  content.bottom <= frame.bottom - requiredBlock + 1,
                hasSafeInset: padInline >= requiredInline && padBlock >= requiredBlock,
                insetDebug: { frameWidth: frame.width, frameHeight: frame.height, padInline, padBlock, requiredInline, requiredBlock },
                textNotClipped: node.scrollHeight <= node.clientHeight,
              };
            });
            return { logoWidth: logoBox.width, cards };
          });
          expect(geometry.logoWidth).toBeGreaterThanOrEqual(160);
          expect(geometry.cards).toHaveLength(4);
          for (const card of geometry.cards) {
            expect(card.hasSafeInset, JSON.stringify(card.insetDebug)).toBe(true);
            expect(card.fitsInnerFrame).toBe(true);
            expect(card.textNotClipped).toBe(true);
          }
          if (width <= 360) {
            const logoTop = await logo.evaluate((node) => node.getBoundingClientRect().top);
            const firstCardTop = await cards.first().evaluate((node) => node.getBoundingClientRect().top);
            expect(logoTop).toBeLessThan(firstCardTop);
          }
        }
      }
    } finally {
      await context.close();
    }
  }
});
