import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES } from "@/data/morocco";
import { prisma } from "@/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;

assertDevBranchDatabase("Sixty-branch visual test");

test("the public map remains usable with sixty real city dataset records", async ({ browser }) => {
  test.setTimeout(240_000);
  const activeBranches = await prisma.branch.findMany({
    where: { active: true },
    select: { geoId: true, createdById: true },
  });
  const needed = Math.max(0, 60 - activeBranches.length);
  const existingGeoIds = new Set(activeBranches.map((branch) => branch.geoId).filter(Boolean));
  const cities = MOROCCAN_CITIES.filter((city) => !existingGeoIds.has(city.id)).slice(0, needed);
  expect(activeBranches.length).toBeLessThanOrEqual(60);
  expect(cities).toHaveLength(needed);
  const creatorId = activeBranches[0]?.createdById;
  expect(creatorId).toBeTruthy();

  const temporaryIds = cities.map(() => randomUUID());
  if (cities.length) {
    await prisma.branch.createMany({
      data: cities.map((city, index) => ({
        id: temporaryIds[index],
        kind: "CITY",
        geoId: city.id,
        nameAr: city.nameAr,
        nameEn: city.nameEn,
        regionId: city.regionId,
        latitude: city.latitude,
        longitude: city.longitude,
        active: true,
        sortOrder: 100 + index,
        createdById: creatorId!,
      })),
    });
  }

  try {
    for (const locale of LOCALES) {
      for (const theme of THEMES) {
        const context = await browser.newContext({
          locale: locale === "ar" ? "ar-MA" : "en-US",
          viewport: { width: 360, height: 850 },
        });
        await context.addInitScript(({ localeValue, themeValue }) => {
          localStorage.setItem("ihyaa-locale", localeValue);
          localStorage.setItem("ihyaa-theme", themeValue);
          document.cookie = `ihyaa-theme=${themeValue}; path=/`;
        }, { localeValue: locale, themeValue: theme });
        const page = await context.newPage();
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          const section = page.locator("#branches");
          await expect(section.locator('button[aria-label*="—"]')).toHaveCount(60, { timeout: 30_000 });
          await expect(section.locator("li")).toHaveCount(60);

          for (const width of [360, 1440]) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await section.screenshot({ path: `evidence/task-05/t4e/branches-60-${width}-${theme}-${locale}.png` });
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    if (temporaryIds.length) {
      await prisma.branch.deleteMany({ where: { id: { in: temporaryIds } } });
    }
    await prisma.$disconnect();
  }
});
