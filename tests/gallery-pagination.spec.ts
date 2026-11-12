import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { assertDevBranchDatabase } from "./helpers/dev-guard";

const prisma = new PrismaClient();

test("gallery initially renders twelve database photos and loads the next page", async ({ page }) => {
  test.setTimeout(60_000);
  assertDevBranchDatabase("Gallery pagination integration test");

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
    fs.mkdirSync("evidence/task-07/t8/gallery", { recursive: true });
    await page.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-locale=en; path=/";
      document.cookie = "ihyaa-theme=light; path=/";
    });
    await page.goto("/gallery");
    const cards = page.locator("[data-gallery-card]");
    await expect(cards).toHaveCount(12);
    await page.screenshot({ path: "evidence/task-07/t8/gallery/gallery-pagination-first-page.png", fullPage: true });

    const loadMore = page.getByRole("button", { name: "Load more photos" });
    await expect(loadMore).toBeVisible();
    await loadMore.click();

    await expect(page.getByRole("button", { name: `${marker}-0` })).toBeVisible({ timeout: 20_000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(13);
    await page.screenshot({ path: "evidence/task-07/t8/gallery/gallery-pagination-after-load-more.png", fullPage: true });
  } finally {
    await prisma.galleryPhoto.deleteMany({
      where: { captionEn: { startsWith: marker } },
    });
    await prisma.$disconnect();
  }
});
