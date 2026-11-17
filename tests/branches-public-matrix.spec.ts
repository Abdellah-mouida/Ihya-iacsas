import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 768, 1280, 1440, 1920] as const;

assertDevBranchDatabase("Public branch map visual test");

test.describe("Public dynamic branches", () => {
  test("renders the database branches without overflow in all themes, locales and target widths", async ({ browser }) => {
    test.setTimeout(300_000);
    fs.mkdirSync("evidence/task-08/t4", { recursive: true });
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({ locale: locale === "ar" ? "ar-MA" : "en-US", viewport: { width: 360, height: 850 } });
        await context.addInitScript(({ localeValue, themeValue }) => {
          localStorage.setItem("ihyaa-locale", localeValue);
          localStorage.setItem("ihyaa-theme", themeValue);
          document.cookie = `ihyaa-theme=${themeValue}; path=/`;
        }, { localeValue: locale, themeValue: theme });
        const page = await context.newPage();
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          const section = page.locator("main section#branches").first();
          await section.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
          await expect(section).toBeVisible({ timeout: 30_000 });
          const markers = section.locator('button[aria-label*="—"]');
          const items = section.locator("[data-testid=branch-inline-item]");
          const branchCount = await items.count();
          await expect(markers).toHaveCount(branchCount, { timeout: 30_000 });
          expect(branchCount).toBeGreaterThan(0);
          for (const item of await items.all()) {
            const chip = item.getByRole("button");
            await expect(chip.getByTestId("branch-chip-name")).toHaveCount(1);
            const onlyName = (await chip.getByTestId("branch-chip-name").textContent())?.trim() ?? "";
            expect(onlyName).not.toBe("");
            await expect(chip).toHaveText(onlyName);
          }
          const firstBranchName = (await items.first().getByTestId("branch-chip-name").textContent())?.trim() ?? "";
          await expect(page.locator("footer")).not.toContainText(firstBranchName);
          await expect(page.locator("footer")).not.toContainText(locale === "ar" ? "فروعنا" : "Our branches");
          await section.scrollIntoViewIfNeeded();

          for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await section.scrollIntoViewIfNeeded();
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            const bounds = await page.evaluate(() => {
              const section = document.querySelector("#branches")!;
              const map = section.querySelector("svg[role='img']")!;
              const sectionRect = section.getBoundingClientRect();
              const mapRect = map.getBoundingClientRect();
              return {
                pageWidth: document.documentElement.scrollWidth,
                sectionWidth: section.scrollWidth,
                sectionClientWidth: section.clientWidth,
                sectionLeft: sectionRect.left,
                sectionRight: sectionRect.right,
                mapLeft: mapRect.left,
                mapRight: mapRect.right,
              };
            });
            expect(bounds.pageWidth).toBeLessThanOrEqual(width);
            expect(bounds.sectionWidth).toBeLessThanOrEqual(bounds.sectionClientWidth);
            expect(bounds.mapLeft).toBeGreaterThanOrEqual(bounds.sectionLeft - 1);
            expect(bounds.mapRight).toBeLessThanOrEqual(bounds.sectionRight + 1);
            await page.evaluate(() => {
              const element = document.querySelector("main section#branches");
              if (element) window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top, behavior: "instant" });
            });
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
            for (const index of [0, Math.floor(branchCount / 2), branchCount - 1]) {
              const marker = markers.nth(index);
              await marker.evaluate((element: HTMLElement) => element.focus({ preventScroll: true }));
              await expect(marker).toHaveAttribute("aria-pressed", "true");
              const tooltip = page.getByTestId("branch-map-tooltip");
              await expect(tooltip).toBeVisible();
              const tooltipBox = await tooltip.boundingBox();
              const sectionBox = await section.boundingBox();
              expect(tooltipBox && sectionBox).toBeTruthy();
              if (tooltipBox && sectionBox) {
                expect(tooltipBox.x).toBeGreaterThanOrEqual(sectionBox.x + 7);
                expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width - 7);
                expect(tooltipBox.y).toBeGreaterThanOrEqual(sectionBox.y + 7);
                expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(sectionBox.y + sectionBox.height - 7);
              }
              const label = await marker.getAttribute("aria-label");
              await expect(tooltip).toContainText(label?.split(" — ")[1] ?? "");
              const contrast = await marker.getByTestId("branch-marker-dot").evaluate((dot) => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) return null;
                const rgb = (value: string) => {
                  context.fillStyle = value;
                  context.fillRect(0, 0, 1, 1);
                  return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
                };
                const contrastRatio = (one: number[], two: number[]) => {
                  const luminance = (color: number[]) => color.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
                  const [light, dark] = [luminance(one), luminance(two)].sort((a, b) => b - a);
                  return (light + 0.05) / (dark + 0.05);
                };
                const active = rgb(getComputedStyle(dot).backgroundColor);
                const tokens = getComputedStyle(document.documentElement);
                const normal = rgb(tokens.getPropertyValue("--main"));
                const foreground = rgb(tokens.getPropertyValue("--foreground"));
                const background = rgb(tokens.getPropertyValue("--background"));
                const colorDistance = Math.hypot(...active.map((channel, index) => channel - normal[index]!));
                return { matchesForeground: active.every((channel, index) => Math.abs(channel - foreground[index]!) < 1), distinct: colorDistance > 40, contrast: contrastRatio(active, background) };
              });
              expect(contrast?.matchesForeground).toBe(true);
              expect(contrast?.distinct).toBe(true);
              expect(contrast?.contrast).toBeGreaterThanOrEqual(3);
              if (index === 0 && [360, 768, 1440, 1920].includes(width)) {
                await page.screenshot({ path: `evidence/task-08/t4/map-tooltip-4-${width}-${theme}-${locale}.png` });
              }
              await marker.evaluate((element: HTMLElement) => element.blur());
            }
            if ([360, 768, 1440, 1920].includes(width)) {
              await section.getByTestId("branches-list").screenshot({ path: `evidence/task-08/t4/branches-${width}-${theme}-${locale}.png` });
            }
          }

          const firstListItem = section.locator("li button").first();
          await firstListItem.hover();
          await expect(section.locator('button[aria-label*="—"][aria-pressed="true"]')).toHaveCount(1);

          const search = section.getByRole("textbox", { name: locale === "ar" ? "البحث عن الفروع" : "Search branches" });
          await search.fill(locale === "ar" ? "طاطا" : "Tata");
          await expect(section.locator("li")).toHaveCount(1);
          const regionId = await section.locator("li").first().getAttribute("data-branch-region");
          expect(regionId).toBeTruthy();
          await search.fill("");
          const filter = section.getByRole("combobox", { name: locale === "ar" ? "تصفية الفروع حسب الجهة" : "Filter branches by region" });
          await filter.click();
          const regionOption = page.locator(`[data-region-id="${regionId}"]`).first();
          await expect(regionOption).toBeVisible();
          const expectedRegionCount = Number((await regionOption.innerText()).match(/\((\d+)\)/)?.[1]);
          await regionOption.click();
          await expect(section.locator("li")).toHaveCount(expectedRegionCount);

          expect(expectedRegionCount).toBe(4);
          const fourItems = section.locator("[data-testid=branch-inline-item]");
          const fourMarkers = section.locator('button[aria-label*="—"]');
          await expect(fourItems).toHaveCount(4);
          await expect(fourMarkers).toHaveCount(4);
          await page.waitForTimeout(750);
          for (const width of [320, 360, 768, 1280, 1920]) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            for (const index of [0, 1, 3]) {
              const marker = fourMarkers.nth(index);
              await marker.evaluate((element: HTMLElement) => element.focus({ preventScroll: true }));
              const tooltip = page.getByTestId("branch-map-tooltip");
              await expect(tooltip).toBeVisible();
              const labelBox = await tooltip.boundingBox();
              const sectionBox = await section.boundingBox();
              expect(labelBox && sectionBox).toBeTruthy();
              if (labelBox && sectionBox) {
                expect(labelBox.x).toBeGreaterThanOrEqual(sectionBox.x + 7);
                expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width - 7);
                expect(labelBox.y).toBeGreaterThanOrEqual(sectionBox.y + 7);
                expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(sectionBox.y + sectionBox.height - 7);
              }
              await marker.evaluate((element: HTMLElement) => element.blur());
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  });
});
