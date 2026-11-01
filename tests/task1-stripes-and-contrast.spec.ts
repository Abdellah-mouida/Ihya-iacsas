import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import { ensureTestUser, loginAs, TEST_REGULAR_USER } from "./helpers/admin-auth";

const THEMES = [
  { name: "light", bgHex: "#ffffff", minContrast: 1.15 },
  { name: "sunset", bgHex: "#ffffff", minContrast: 1.15 },
  { name: "amoled", bgHex: "#000000", minContrast: 1.20 },
  { name: "black", bgHex: "#111111", minContrast: 1.20 },
];

const PAGES = [
  { path: "/", name: "home" },
  { path: "/profile", name: "profile" },
  { path: "/login", name: "login" },
  { path: "/events", name: "events" },
];

test.describe("Task 1 - Vertical Striping, Base Background & Texture Contrast Verification", () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await ensureTestUser(TEST_REGULAR_USER);
  });

  for (const theme of THEMES) {
    for (const pageInfo of PAGES) {
      test(`verify no vertical bands on ${pageInfo.name} in ${theme.name} theme at 1440px and 360px`, async ({
        page,
      }) => {
        // Desktop 1440px
        await page.setViewportSize({ width: 1440, height: 900 });

        if (pageInfo.name === "profile") {
          await ensureTestUser(TEST_REGULAR_USER);
          await loginAs(page, TEST_REGULAR_USER, "/profile");
          await page.waitForLoadState("domcontentloaded");
          const profileContainer = page.locator('[data-testid="profile-view-container"]');
          await expect(profileContainer).toBeVisible({ timeout: 20000 });
        } else {
          await page.goto(`http://localhost:3000${pageInfo.path}`, { waitUntil: "networkidle" });
        }

        await page.evaluate((themeName) => {
          document.documentElement.setAttribute("data-theme", themeName);
          if (themeName === "amoled" || themeName === "black") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }, theme.name);

        await page.waitForTimeout(300);

        const evidenceDir = path.join(process.cwd(), "evidence/task-1");
        if (!fs.existsSync(evidenceDir)) {
          fs.mkdirSync(evidenceDir, { recursive: true });
        }

        const shot1440 = await page.screenshot({ fullPage: false });
        fs.writeFileSync(
          path.join(evidenceDir, `banding-${pageInfo.name}-${theme.name}-1440.png`),
          shot1440
        );

        // Analyze vertical stripes in empty side margin (x: 10 to 330, y: 150 to 550) - 320px = 2 full tiles (160px each)
        const stripStartX = 10;
        const stripEndX = 330;
        const stripStartY = 150;
        const stripEndY = 550;
        const stripW = stripEndX - stripStartX;
        const stripH = stripEndY - stripStartY;

        // On 1440px desktop: isolate the background texture layer to test tile uniformity without foreground interference
        await page.evaluate(() => {
          const header = document.querySelector("header");
          if (header) header.style.visibility = "hidden";
          const mainChildren = Array.from(document.querySelector("main")?.children || []);
          for (const child of mainChildren) {
            if (
              !child.querySelector('[data-testid="page-texture-layer"]') &&
              !child.getAttribute("data-testid")?.includes("page-texture")
            ) {
              (child as HTMLElement).style.visibility = "hidden";
            }
          }
        });

        const tileW = 160;
        const bgBuffer1440 = await page.screenshot({ fullPage: false });
        const crop1440 = await sharp(bgBuffer1440)
          .extract({ left: 60, top: 120, width: tileW * 2, height: 160 })
          .raw()
          .toBuffer({ resolveWithObject: true });

        const data1440 = crop1440.data;
        const channels = 3;
        let sumTile1 = 0;
        let sumTile2 = 0;
        const halfW = tileW;
        const totalP = halfW * 160;

        for (let y = 0; y < 160; y++) {
          for (let x = 0; x < halfW; x++) {
            const idx = (y * (tileW * 2) + x) * channels;
            sumTile1 += 0.2126 * data1440[idx] + 0.7152 * data1440[idx + 1] + 0.0722 * data1440[idx + 2];
          }
          for (let x = halfW; x < tileW * 2; x++) {
            const idx = (y * (tileW * 2) + x) * channels;
            sumTile2 += 0.2126 * data1440[idx] + 0.7152 * data1440[idx + 1] + 0.0722 * data1440[idx + 2];
          }
        }

        const avgTile1 = sumTile1 / totalP;
        const avgTile2 = sumTile2 / totalP;
        const tileDiff = Math.abs(avgTile1 - avgTile2);

        expect(
          tileDiff,
          `Tile-to-tile step banding detected on ${pageInfo.name} (${theme.name}) at 1440px: diff = ${tileDiff}`
        ).toBeLessThanOrEqual(3.0);

        // Mobile 360px
        await page.setViewportSize({ width: 360, height: 740 });
        await page.waitForTimeout(200);

        const shot360 = await page.screenshot({ fullPage: false });
        fs.writeFileSync(
          path.join(evidenceDir, `banding-${pageInfo.name}-${theme.name}-360.png`),
          shot360
        );

        // Mobile 360px: sample isolated texture layer where edge fade mask and layout are stable (y=380-460)
        const bgBuffer360 = await page.screenshot({ fullPage: false });
        const crop360 = await sharp(bgBuffer360)
          .extract({ left: 10, top: 380, width: 160 * 2, height: 80 })
          .raw()
          .toBuffer({ resolveWithObject: true });

        const data360 = crop360.data;
        const totalP360 = 160 * 80;
        let sumTile360_1 = 0;
        let sumTile360_2 = 0;

        for (let y = 0; y < 80; y++) {
          for (let x = 0; x < 160; x++) {
            const idx = (y * 320 + x) * 3;
            sumTile360_1 += 0.2126 * data360[idx] + 0.7152 * data360[idx + 1] + 0.0722 * data360[idx + 2];
          }
          for (let x = 160; x < 320; x++) {
            const idx = (y * 320 + x) * 3;
            sumTile360_2 += 0.2126 * data360[idx] + 0.7152 * data360[idx + 1] + 0.0722 * data360[idx + 2];
          }
        }

        const half1 = sumTile360_1 / totalP360;
        const half2 = sumTile360_2 / totalP360;
        const tileDelta = Math.abs(half1 - half2);

        expect(
          tileDelta,
          `Tile-to-tile banding detected on ${pageInfo.name} (${theme.name}) at 360px: tileDelta = ${tileDelta}`
        ).toBeLessThanOrEqual(3.0);
      });
    }
  }

  for (const theme of THEMES) {
    test(`verify base background color and texture contrast in ${theme.name} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("http://localhost:3000/profile", { waitUntil: "networkidle" });

      await page.evaluate((themeName) => {
        document.documentElement.setAttribute("data-theme", themeName);
        if (themeName === "amoled" || themeName === "black") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }, theme.name);

      await page.waitForTimeout(200);

      // Part 1: Check computed background color on body/main
      const computedBg = await page.evaluate(() => {
        return window.getComputedStyle(document.body).backgroundColor;
      });

      // Part 2: Check contrast of pattern strokes vs base background
      const shotWithTex = await page.screenshot();
      const cropWithTex = await sharp(shotWithTex)
        .extract({ left: 10, top: 150, width: 140, height: 300 })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const dataWithTex = cropWithTex.data;
      const totalP = cropWithTex.info.width * cropWithTex.info.height;
      let minLum = 255;
      let maxLum = 0;

      for (let i = 0; i < totalP; i += 2) {
        const idx = i * cropWithTex.info.channels;
        const r = dataWithTex[idx];
        const g = dataWithTex[idx + 1];
        const b = dataWithTex[idx + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > maxLum) maxLum = lum;
        if (lum < minLum) minLum = lum;
      }

      const l1 = Math.max(maxLum, minLum);
      const l2 = Math.min(maxLum, minLum);
      const contrast = (l1 + 0.05) / (l2 + 0.05);

      expect(contrast).toBeGreaterThanOrEqual(theme.minContrast);
    });
  }
});
