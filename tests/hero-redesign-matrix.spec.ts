import { expect, test } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";

import { IMAGES, resolveImageUrl } from "@/lib/content";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 390, 768, 1280, 1440, 1920, 2560] as const;
const SCREENSHOT_WIDTHS = new Set([360, 768, 1440, 1920]);
const EXPECTED_HEADLINE = {
  ar: "أَوَمَن كَانَ مَيۡتٗا فَأَحۡيَيۡنَٰهُ",
  en: "“And is one who was dead and We gave him life”",
} as const;

test.describe("Home hero redesign", () => {
  test("serves the new AVIF for saved references to the retired JPG", () => {
    expect(resolveImageUrl("/images/group-portrait.jpg")).toBe(IMAGES.groupPortrait);
  });

  test("keeps the photo, copy, interlock and background seam stable across themes, locales and widths", async ({ browser }) => {
    test.setTimeout(300_000);
    fs.mkdirSync("evidence/task-07/t3", { recursive: true });

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
          (window as Window & { __heroVitals?: { lcp: number; cls: number } }).__heroVitals = { lcp: 0, cls: 0 };
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const metrics = (window as Window & { __heroVitals?: { lcp: number; cls: number } }).__heroVitals;
              if (metrics) metrics.lcp = entry.startTime;
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
              const sources = (shift as PerformanceEntry & { sources?: Array<{ node: Element | null }> }).sources ?? [];
              const affectsHero = sources.some((source) => source.node?.closest?.("#home"));
              const firstContentfulPaint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
              if (affectsHero && !shift.hadRecentInput && firstContentfulPaint !== undefined && shift.startTime >= firstContentfulPaint) {
                const metrics = (window as Window & { __heroVitals?: { lcp: number; cls: number } }).__heroVitals;
                if (metrics) metrics.cls += shift.value;
              }
            }
          }).observe({ type: "layout-shift", buffered: true });
        }, { localeValue: locale, themeValue: theme });

        const page = await context.newPage();
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          const hero = page.locator("#home");
          const heading = hero.getByRole("heading", { level: 1 });
          await expect(heading).toHaveText(EXPECTED_HEADLINE[locale]);
          await expect(hero.getByTestId("hero-reference")).toHaveCount(0);
          const minTitleContrast = await page.evaluate(() => {
            const context = document.createElement("canvas").getContext("2d");
            if (!context) throw new Error("Canvas is unavailable for contrast checks");
            const rgb = (color: string) => {
              context.fillStyle = color;
              context.fillRect(0, 0, 1, 1);
              return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
            };
            const luminance = (channel: number) => {
              const value = channel / 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            };
            const contrast = (foreground: number[], background: number[]) => {
              const [lighter, darker] = [foreground, background]
                .map((color) => 0.2126 * luminance(color[0]) + 0.7152 * luminance(color[1]) + 0.0722 * luminance(color[2]))
                .sort((a, b) => b - a);
              return (lighter + 0.05) / (darker + 0.05);
            };
            const background = rgb(getComputedStyle(document.documentElement).getPropertyValue("--background").trim());
            return Math.min(...[...document.querySelectorAll("#home h1 [data-testid='hero-fold-piece']")]
              .filter((node) => node.textContent?.trim())
              .map((node) => contrast(rgb(getComputedStyle(node).color), background)));
          });
          expect(minTitleContrast, `Hero title contrast in ${locale}/${theme}`).toBeGreaterThanOrEqual(3);
          await expect(hero.getByText(locale === "ar" ? "برنامج إحياء الشبابي" : "Ihyaa Youth Program")).toBeVisible();
          await expect(hero.getByRole("link", { name: locale === "ar" ? /اكتشف الفعاليات/ : /Explore events/ })).toBeVisible();
          await expect(hero.getByRole("link", { name: locale === "ar" ? /عن البرنامج/ : /About the program/ })).toBeVisible();

          const image = hero.locator("img[src*='group-portrait']").first();
          await expect(image).toBeVisible();
          await image.evaluate((node: HTMLImageElement) => node.decode());
          expect(await image.getAttribute("sizes")).toContain("607px");
          const geometry = await page.evaluate(() => {
            const frame = document.querySelector("#home [data-testid='hero-frame']") as HTMLElement | null;
            const copy = document.querySelector("#home [data-testid='hero-copy']") as HTMLElement | null;
            const photo = document.querySelector("#home [data-testid='hero-photo-frame']") as HTMLElement | null;
            if (!frame || !copy || !photo) return null;
            const f = frame.getBoundingClientRect();
            const c = copy.getBoundingClientRect();
            const p = photo.getBoundingClientRect();
            return {
              frame: { left: f.left, right: f.right, top: f.top, bottom: f.bottom, width: f.width, height: f.height },
              copy: { left: c.left, right: c.right, top: c.top, bottom: c.bottom },
              photo: { top: p.top, height: p.height },
              clipPath: getComputedStyle(photo).clipPath,
              headingLines: new Set([...document.querySelectorAll("#home [data-testid='hero-heading-word']")].map((word) => Math.round(word.getBoundingClientRect().top))).size,
            };
          });
          expect(geometry).not.toBeNull();
          if (!geometry) throw new Error("Hero geometry is unavailable");
          expect(geometry.headingLines).toBeLessThanOrEqual((page.viewportSize()?.width ?? 360) <= 360 ? 3 : 2);
          expect(geometry.clipPath).toContain("ihyaa-hero-splash");
          await expect(hero.getByTestId("hero-sticker")).toHaveCount(0);
          await expect(hero.getByTestId("hero-marquee")).toHaveCount(0);
          const copyOverlap = geometry.copy.left < geometry.frame.right && geometry.copy.right > geometry.frame.left && geometry.copy.top < geometry.frame.bottom && geometry.copy.bottom > geometry.frame.top;
          expect(copyOverlap, "Hero copy must remain outside the portrait and every face").toBe(false);

          await page.waitForTimeout(1200);
          const vitals = await page.evaluate(() => (window as Window & { __heroVitals?: { lcp: number; cls: number } }).__heroVitals ?? { lcp: 0, cls: 0 });
          expect(vitals.cls, `CLS in ${locale}/${theme}`).toBeLessThanOrEqual(0.001);
          if (page.viewportSize()?.width === 360) {
            expect(vitals.lcp, `LCP in ${locale}/${theme}`).toBeGreaterThan(0);
            expect(vitals.lcp, `LCP must stay below 2.5s in ${locale}/${theme}`).toBeLessThan(2500);
          }

          for (const width of WIDTHS) {
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.setViewportSize({ width, height: 900 });
            const responsiveImage = await image.evaluate(async (node: HTMLImageElement) => {
              await node.decode();
              return {
                src: node.currentSrc,
                ratio: node.naturalWidth / node.naturalHeight,
              };
            });
            expect(responsiveImage.ratio).toBeCloseTo(4096 / 3032, 1);
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            const seamDocumentY = await hero.evaluate((node) => Math.round(node.getBoundingClientRect().bottom + window.scrollY));
            await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 400)), seamDocumentY);
            const seamY = await hero.evaluate((node) => Math.round(node.getBoundingClientRect().bottom));
            expect(seamY).toBeGreaterThan(2);
            expect(seamY + 2).toBeLessThan(900);
            const seamShot = await page.screenshot({
              clip: { x: 0, y: seamY - 2, width, height: 5 },
              animations: "disabled",
            });
            const { data, info } = await sharp(seamShot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            let upperSum = 0;
            let lowerSum = 0;
            let sampled = 0;
            for (const x of [...Array(Math.min(12, width)).keys(), ...Array.from({ length: Math.min(12, width) }, (_, index) => width - Math.min(12, width) + index)]) {
              const upper = (1 * info.width + x) * info.channels;
              const lower = (3 * info.width + x) * info.channels;
              const lumUpper = 0.2126 * data[upper] + 0.7152 * data[upper + 1] + 0.0722 * data[upper + 2];
              const lumLower = 0.2126 * data[lower] + 0.7152 * data[lower + 1] + 0.0722 * data[lower + 2];
              upperSum += lumUpper;
              lowerSum += lumLower;
              sampled += 1;
            }
            const maxStep = Math.abs(upperSum / sampled - lowerSum / sampled);
            expect(maxStep, `Hero/About background luminance step ${maxStep.toFixed(2)} at ${width}px ${locale}/${theme}`).toBeLessThanOrEqual(3);

            await page.evaluate(() => window.scrollTo(0, 0));
            if (SCREENSHOT_WIDTHS.has(width)) {
              await page.screenshot({
              path: `evidence/task-07/t3/hero-${width}-${theme}-${locale}.png`,
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

  test("uses a static version when reduced motion is requested", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 850 }, reducedMotion: "reduce" });
    try {
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "networkidle" });
      const states = await page.locator("#home h1 [data-testid='hero-heading-word'], #home img[src*='group-portrait'], #home .splashOrnaments").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).animationName));
      expect(states.length).toBeGreaterThan(0);
      expect(states.every((animation) => animation === "none")).toBe(true);
      await expect(page.locator("#home h1")).toBeVisible();
      await expect(page.locator("#home img[src*='group-portrait']")).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
