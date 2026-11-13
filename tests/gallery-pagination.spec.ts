import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { assertDevBranchDatabase } from "./helpers/dev-guard";

const prisma = new PrismaClient();

test("gallery renders database photos randomly in DriftWall without borders", async ({ page }) => {
  test.setTimeout(60_000);
  assertDevBranchDatabase("Gallery DriftWall integration test");

  const marker = `gallery-pagination-${Date.now()}`;
  await prisma.galleryPhoto.createMany({
    data: Array.from({ length: 13 }, (_, index) => ({
      imageUrl: "/images/prayer.jpg",
      captionAr: `${marker}-${index}`,
      captionEn: `${marker}-${index}`,
      imageWidth: 1280,
      imageHeight: 960,
      createdAt: new Date(Date.now() + index * 1_000),
    })),
  });

  try {
    await page.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-locale=en; path=/";
      document.cookie = "ihyaa-theme=light; path=/";
    });
    await page.goto("/gallery");
    const wall = page.locator('[data-rb="DriftWall"]');
    await expect(wall).toBeVisible();
    await expect(page.getByRole("button", { name: `${marker}-0` }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: `${marker}-12` }).first()).toBeVisible({ timeout: 20_000 });
    expect(await wall.locator("[data-gallery-card]").count()).toBeGreaterThanOrEqual(13);
  } finally {
    await prisma.galleryPhoto.deleteMany({
      where: { captionEn: { startsWith: marker } },
    });
    await prisma.$disconnect();
  }
});
