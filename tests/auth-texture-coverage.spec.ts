import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import sharp from "sharp";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 390, 768, 1024, 1440] as const;
const AUTH_ROUTES = [
  { name: "login", path: "/login", ready: '[data-testid="login-view"]' },
  { name: "signup", path: "/signup", ready: '[data-testid="signup-view"]' },
  { name: "forgot-password", path: "/forgot-password", ready: '[data-testid="forgot-title"]' },
] as const;

function luminance(r: number, g: number, b: number) {
  const linear = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

async function stripContrast(page: Page, side: "left" | "right") {
  const { width } = page.viewportSize()!;
  const clipWidth = Math.min(40, Math.floor(width / 3));
  const x = side === "left" ? 4 : width - clipWidth - 4;
  const on = await page.screenshot({ clip: { x, y: 220, width: clipWidth, height: 300 } });
  await page.locator(".site-atmosphere-pattern").evaluate((el) => {
    (el as SVGElement).style.visibility = "hidden";
  });
  const off = await page.screenshot({ clip: { x, y: 220, width: clipWidth, height: 300 } });
  await page.locator(".site-atmosphere-pattern").evaluate((el) => {
    (el as SVGElement).style.visibility = "";
  });

  const visible = await sharp(on).removeAlpha().raw().toBuffer();
  const hidden = await sharp(off).removeAlpha().raw().toBuffer();
  let maxContrast = 1;
  let visiblePixels = 0;
  for (let i = 0; i < visible.length; i += 3) {
    const onLum = luminance(visible[i], visible[i + 1], visible[i + 2]);
    const offLum = luminance(hidden[i], hidden[i + 1], hidden[i + 2]);
    const ratio = (Math.max(onLum, offLum) + 0.05) / (Math.min(onLum, offLum) + 0.05);
    maxContrast = Math.max(maxContrast, ratio);
    if (ratio >= 1.05) visiblePixels++;
  }
  return { maxContrast, visiblePixels };
}

test.describe("Auth background coverage and themed image overlays", () => {
  test.setTimeout(300_000);

  test("auth strips preserve the root pattern and side-image panels remain theme-based", async ({ browser }) => {
    fs.mkdirSync("evidence/task-4", { recursive: true });
    const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");

    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          baseURL,
          locale: locale === "ar" ? "ar-MA" : "en-US",
          viewport: { width: 1440, height: 1000 },
        });
        try {
          await context.addInitScript(({ localeValue, themeValue }) => {
            localStorage.setItem("ihyaa-locale", localeValue);
            localStorage.setItem("ihyaa-theme", themeValue);
          }, { localeValue: locale, themeValue: theme });
          const page = await context.newPage();
          await page.goto("/privacy", { waitUntil: "domcontentloaded" });
          await expect(page.locator('[data-testid="privacy-page"]')).toBeVisible();
          const reference = {
            left: await stripContrast(page, "left"),
            right: await stripContrast(page, "right"),
          };

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            for (const route of AUTH_ROUTES) {
              await page.goto(route.path, { waitUntil: "domcontentloaded" });
              await expect(page.locator(route.ready).first(), `${route.name} view is ready`).toBeVisible({ timeout: 30_000 });
              expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

              const surfaceState = await page.evaluate(() => {
                const wrappers = [
                  document.querySelector("main"),
                  document.querySelector('[data-testid="signup-view"]')?.parentElement,
                  document.querySelector("body > div.relative.z-10"),
                ].filter((element): element is HTMLElement => Boolean(element));
                const points = [
                  { x: 8, y: 420 },
                  { x: window.innerWidth - 8, y: 420 },
                ];
                return {
                  wrappers: wrappers.map((element) => getComputedStyle(element).backgroundColor),
                  points: points.map(({ x, y }) => document.elementsFromPoint(x, y)
                    .filter((element) => element !== document.body && element !== document.documentElement)
                    .map((element) => getComputedStyle(element).backgroundColor)),
                  textureOpacity: getComputedStyle(document.querySelector(".site-atmosphere-pattern")!).opacity,
                  textureColor: getComputedStyle(document.querySelector(".site-atmosphere-pattern")!).color,
                  main: (() => {
                    const probe = document.createElement("span");
                    probe.style.color = "var(--main)";
                    document.body.append(probe);
                    const color = getComputedStyle(probe).color;
                    probe.remove();
                    return color;
                  })(),
                };
              });
              expect(surfaceState.wrappers.every((color) => color === "rgba(0, 0, 0, 0)"), `${route.name} wrappers stay transparent`).toBe(true);
              expect(surfaceState.points.flat().every((color) => color === "rgba(0, 0, 0, 0)"), `${route.name} side strips have no opaque cover`).toBe(true);
              expect(Number(surfaceState.textureOpacity)).toBeGreaterThan(0);
              expect(surfaceState.textureColor).toBe(surfaceState.main);

              if (width === 1440) {
                for (const side of ["left", "right"] as const) {
                  const measured = await stripContrast(page, side);
                  expect(measured.maxContrast, `${theme}/${locale}/${route.name} ${side} strip`).toBeGreaterThanOrEqual(1.05);
                  expect(Math.abs(measured.maxContrast - reference[side].maxContrast), `${theme}/${locale}/${route.name} ${side} strip matches public page`).toBeLessThanOrEqual(0.01);
                }
              }
              await page.screenshot({
                path: `evidence/task-4/auth-${route.name}-${width}-${theme}-${locale}.png`,
                fullPage: true,
              });
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  });
});
