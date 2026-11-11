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
    fs.mkdirSync("evidence/task-07/t5", { recursive: true });
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
          for (const coordinates of await section.getByTestId("branch-coordinates").allTextContents()) {
            expect(coordinates.trim()).toMatch(/^-?\d+\.\d{5}, -?\d+\.\d{5}$/);
          }
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
            if ([360, 768, 1440, 1920].includes(width)) {
              await section.getByTestId("branches-list").screenshot({ path: `evidence/task-07/t5/branches-${width}-${theme}-${locale}.png` });
            }
          }

          const firstMarker = markers.first();
          await firstMarker.focus();
          await expect(firstMarker).toHaveAttribute("aria-pressed", "true");
          await expect(section.locator("ul").getByRole("button", { pressed: true })).toHaveCount(1);
          const tooltip = section.getByTestId("branch-map-tooltip");
          await expect(tooltip).toBeVisible();
          const tooltipBox = await tooltip.boundingBox();
          const sectionBox = await section.boundingBox();
          expect(tooltipBox && sectionBox).toBeTruthy();
          if (tooltipBox && sectionBox) {
            expect(tooltipBox.x).toBeGreaterThanOrEqual(sectionBox.x - 1);
            expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width + 1);
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
        } finally {
          await context.close();
        }
      }
    }
  });
});
