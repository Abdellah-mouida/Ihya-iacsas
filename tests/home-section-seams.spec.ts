import { test, expect } from "@playwright/test";
import sharp from "sharp";
import fs from "fs";
import path from "path";

const THEMES = ["light", "sunset", "amoled", "black"];

// Home page section boundaries to audit
const SECTION_PAIRS = [
  { prev: "hero", next: "#about", name: "hero-to-about" },
  { prev: "#about", next: "#activities", name: "about-to-activities" },
  { prev: "#activities", next: "#branches", name: "activities-to-branches" },
  { prev: "#branches", next: "#cards", name: "branches-to-cards" },
  { prev: "#cards", next: "#gallery", name: "cards-to-gallery" },
  { prev: "#gallery", next: "#program", name: "gallery-to-program" },
  { prev: "#program", next: "#contact", name: "program-to-contact" },
  { prev: "#contact", next: "footer", name: "contact-to-footer" },
];

test.describe("Task 2: Section Boundary Seams & Line Removal Audit", () => {
  test.beforeAll(async () => {
    const dir = path.join(process.cwd(), "evidence/task-2");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  for (const theme of THEMES) {
    test(`audits section boundaries in ${theme} theme without boundary lines or seams`, async ({
      page,
    }) => {
      // Set viewport
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Apply theme
      await page.evaluate((t) => {
        document.documentElement.classList.remove("dark");
        if (t === "amoled" || t === "black") {
          document.documentElement.classList.add("dark");
        }
        document.documentElement.setAttribute("data-theme", t);
      }, theme);

      await page.waitForTimeout(300);

      for (const pair of SECTION_PAIRS) {
        const nextLocator = page.locator(pair.next).first();
        const count = await nextLocator.count();
        if (count === 0) {
          // Section conditionally rendered (e.g. #cards returns null if no cards in DB)
          console.log(`[${theme}] skipping ${pair.name} - ${pair.next} not rendered`);
          continue;
        }

        await expect(nextLocator).toBeVisible();
        const box = await nextLocator.boundingBox();
        expect(box).toBeTruthy();

        if (box) {
          // Scroll section into view
          await nextLocator.scrollIntoViewIfNeeded();
          await page.waitForTimeout(100);

          // In Playwright, element.boundingBox() after scroll gives current viewport-relative coordinates
          const scrolledBox = await nextLocator.boundingBox();
          if (!scrolledBox) continue;

          // Ensure the boundary is inside the viewport
          const clipY = Math.max(0, Math.min(860, scrolledBox.y - 20));

          const stripBuffer = await page.screenshot({
            clip: {
              x: 40,
              y: clipY,
              width: 80,
              height: 40,
            },
          });

          // Save evidence
          const evidenceFile = path.join(
            process.cwd(),
            `evidence/task-2/${pair.name}-${theme}.png`
          );
          fs.writeFileSync(evidenceFile, stripBuffer);

          // Compute row luminance
          const { data, info } = await sharp(stripBuffer)
            .raw()
            .toBuffer({ resolveWithObject: true });

          const rowLums: number[] = [];
          for (let row = 0; row < info.height; row++) {
            let sum = 0;
            for (let col = 0; col < info.width; col++) {
              const idx = (row * info.width + col) * info.channels;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              sum += 0.299 * r + 0.587 * g + 0.114 * b;
            }
            rowLums.push(sum / info.width);
          }

          // Check adjacent row-to-row luminance jump
          let maxDelta = 0;
          for (let i = 1; i < rowLums.length; i++) {
            const delta = Math.abs(rowLums[i] - rowLums[i - 1]);
            if (delta > maxDelta) maxDelta = delta;
          }

          // Continuous background sections: seam step <= 3.0 / 255 (no divider line or shadow shelf).
          // Hero has full photographic imagery fading into the page background; no sharp border line (maxDelta < 60.0).
          const threshold = pair.name === "hero-to-about" ? 60.0 : 3.0;

          expect(
            maxDelta,
            `Seam step between ${pair.prev} and ${pair.next} in theme '${theme}' was ${maxDelta.toFixed(2)}, expected <= ${threshold}`
          ).toBeLessThanOrEqual(threshold);
        }
      }
    });
  }
});
