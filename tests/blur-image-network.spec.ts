import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

import { createImagePlaceholder } from "../src/lib/image-placeholder";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

const prisma = new PrismaClient();

test("gallery placeholder remains while the image is throttled, then swaps without image layout shift", async ({ page }) => {
  test.setTimeout(60_000);
  assertDevBranchDatabase("Blur image network integration test");

  const imagePath = "/images/group-portrait-hero-384.avif";
  const imageBuffer = fs.readFileSync(path.join(process.cwd(), "public", imagePath));
  const metadata = await createImagePlaceholder(imageBuffer);
  const marker = `blur-network-${Date.now()}`;
  const photo = await prisma.galleryPhoto.create({
    data: {
      imageUrl: imagePath,
      captionAr: marker,
      captionEn: marker,
      ...metadata,
    },
  });

  let releaseImage!: () => void;
  let imageRequestArrived!: () => void;
  const imageGate = new Promise<void>((resolve) => { releaseImage = resolve; });
  const requested = new Promise<void>((resolve) => { imageRequestArrived = resolve; });

  try {
    await page.route("**/_next/image**", async (route) => {
      if (route.request().url().includes(encodeURIComponent(imagePath))) {
        imageRequestArrived();
        await imageGate;
      }
      await route.continue();
    });

    await page.goto("/gallery", { waitUntil: "domcontentloaded" });
    const tile = page.getByRole("button", { name: marker }).first();
    await expect(tile).toBeVisible({ timeout: 20_000 });
    await tile.scrollIntoViewIfNeeded();
    const placeholder = tile.getByTestId("blur-placeholder");
    await expect(placeholder).toBeVisible();
    await requested;

    await page.evaluate(() => {
      const shifts: number[] = [];
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries() as PerformanceEntry[]) {
          const layoutShift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!layoutShift.hadRecentInput) shifts.push(layoutShift.value);
        }
      }).observe({ type: "layout-shift", buffered: false });
      Object.assign(window, { __blurImageShifts: shifts });
    });

    releaseImage();
    await expect(tile.getByTestId("blur-placeholder")).toHaveCount(0, { timeout: 10_000 });
    await expect(tile.locator("img")).toHaveCSS("opacity", "1");
    await page.waitForTimeout(200);
    const shifts = await page.evaluate(() => (window as Window & { __blurImageShifts?: number[] }).__blurImageShifts ?? []);
    expect(shifts.reduce((sum, value) => sum + value, 0)).toBe(0);
  } finally {
    releaseImage();
    await prisma.galleryPhoto.deleteMany({ where: { id: photo.id } });
    await prisma.$disconnect();
  }
});
