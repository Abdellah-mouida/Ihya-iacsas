import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES } from "@/data/morocco";
import { prisma } from "@/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { ensureTestUser, loginAs, TEST_ADMIN } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;

assertDevBranchDatabase("Sixty-branch visual test");

test("the public map remains usable with sixty real city dataset records", async ({ browser, page }) => {
  test.setTimeout(240_000);
  const testAdmin = await ensureTestUser(TEST_ADMIN);
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
  await page.addInitScript(() => {
    localStorage.setItem("ihyaa-locale", "en");
    localStorage.setItem("ihyaa-theme", "light");
    document.cookie = "ihyaa-theme=light; path=/";
  });
  await loginAs(page, TEST_ADMIN, "/admin/branches");

  async function refreshBranchesTagUsingTemporaryRow(finalActive = true) {
    const city = cities[0];
    const id = temporaryIds[0];
    if (!city || !id) return;

    await page.goto("/admin/branches");
    const search = page.getByRole("textbox", { name: "Search" });
    await search.fill(city.nameEn);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 });
    const row = page.locator(`[data-branch-id="${id}"]`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    const visible = row.getByRole("button", { name: "Visible" });
    const hidden = row.getByRole("button", { name: "Hidden" });
    const visibleNow = await visible.count();
    if (finalActive) {
      if (!visibleNow) {
        await hidden.click();
        await expect(visible).toBeVisible({ timeout: 30_000 });
      }
      await visible.click();
      await expect(hidden).toBeVisible({ timeout: 30_000 });
      await hidden.click();
      await expect(visible).toBeVisible({ timeout: 30_000 });
    } else {
      if (visibleNow) {
        await visible.click();
        await expect(hidden).toBeVisible({ timeout: 30_000 });
      }
      await hidden.click();
      await expect(visible).toBeVisible({ timeout: 30_000 });
      await visible.click();
      await expect(hidden).toBeVisible({ timeout: 30_000 });
    }
  }

  async function waitForPublicBranchCount(expected: number) {
    await page.goto("/");
    const markers = page.locator('#branches button[aria-label*="—"]');
    // The map is a client-only dynamic import. Wait for hydration before
    // counting; an immediate count after DOMContentLoaded can incorrectly be 0.
    await expect.poll(() => markers.count(), { timeout: 15_000, intervals: [100, 250, 500] }).not.toBe(0);
    const deadline = Date.now() + 30_000;
    let count = await markers.count();
    while (count !== expected && Date.now() < deadline) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect.poll(() => markers.count(), { timeout: 10_000, intervals: [100, 250, 500] }).not.toBe(0);
      count = await markers.count();
    }
    expect(count).toBe(expected);
  }

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
    await refreshBranchesTagUsingTemporaryRow();
    if (temporaryIds.length) await waitForPublicBranchCount(60);
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
          const collapsedGroups = section.locator('[data-testid="branch-region-expander"][aria-expanded="false"]');
          while (await collapsedGroups.count()) await collapsedGroups.first().click();
          await expect(section.locator("li")).toHaveCount(60);

          for (const width of [360, 1440]) {
            await page.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await expect.poll(() => section.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
            await page.evaluate(() => {
              const element = document.querySelector("#branches");
              if (element) window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top, behavior: "instant" });
            });
            await page.screenshot({ path: `evidence/task-06/t4/branches-60-${width}-${theme}-${locale}.png` });
          }
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    if (temporaryIds.length) {
      try {
        await prisma.branch.updateMany({ where: { id: { in: temporaryIds } }, data: { active: false } });
        await refreshBranchesTagUsingTemporaryRow(false);
        await waitForPublicBranchCount(activeBranches.length);
      } finally {
        await prisma.auditLog.deleteMany({ where: { targetId: { in: temporaryIds } } });
        await prisma.branch.deleteMany({ where: { id: { in: temporaryIds } } });
      }
    }
    await prisma.auditLog.deleteMany({ where: { actorId: testAdmin.id } });
    await prisma.user.deleteMany({ where: { id: testAdmin.id, email: TEST_ADMIN.email } });
    await prisma.$disconnect();
  }
});
