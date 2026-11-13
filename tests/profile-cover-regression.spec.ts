import { expect, test } from "@playwright/test";
import fs from "node:fs";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

test("profile cover and settings crop match at required widths, themes, and locales", async ({ page }) => {
  test.setTimeout(600_000);
  assertDevBranchDatabase("Profile cover regression screenshots");
  fs.mkdirSync("evidence/task-05/t2", { recursive: true });

  const user = await createSyntheticUser("Profile cover regression screenshots");
  const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");

  try {
    await prisma.user.update({ where: { id: user.id }, data: { onboardingCompletedAt: new Date() } });
    await page.goto(`/login?callbackUrl=${encodeURIComponent("/profile")}`);
    await page.locator('[data-testid="login-email-input"]').fill(user.email);
    await page.locator('[data-testid="login-password-input"]').fill(user.password);
    await page.locator('[data-testid="login-submit-btn"]').click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 30_000 });

    for (const width of [360, 768, 1440] as const) {
      await page.setViewportSize({ width, height: 1000 });
      let profileAspectForWidth = 0;

      for (const coverState of ["default", "uploaded"] as const) {
        const expectedCover = coverState === "default" ? null : "/images/gathering.jpg";
        await prisma.user.update({
          where: { id: user.id },
          data: { coverImage: expectedCover },
        });
        expect((await prisma.user.findUnique({ where: { id: user.id }, select: { coverImage: true } }))?.coverImage).toBe(expectedCover);

        for (const locale of ["ar", "en"] as const) {
          for (const theme of ["light", "sunset", "amoled", "black"] as const) {
            await page.evaluate(({ localeValue, themeValue }) => {
              localStorage.setItem("ihyaa-locale", localeValue);
              localStorage.setItem("ihyaa-theme", themeValue);
            }, { localeValue: locale, themeValue: theme });

            await page.goto("/profile");
            const profileFrame = page.locator('[data-testid="profile-cover-frame"]');
            await expect(profileFrame).toBeVisible();
            await expect(profileFrame).toHaveAttribute("data-cover-source", expectedCover ?? "default");
            const profileFrameBox = await profileFrame.boundingBox();
            expect(profileFrameBox).toBeTruthy();
            const profileAspect = profileFrameBox ? profileFrameBox.width / profileFrameBox.height : 0;
            profileAspectForWidth = profileAspect;
            const avatarBox = await page.locator('[data-testid="profile-avatar-ring"]').boundingBox();
            expect(avatarBox).toBeTruthy();
            if (profileFrameBox && avatarBox) {
              const coverBottom = profileFrameBox.y + profileFrameBox.height;
              expect(avatarBox.y, `avatar must overlap cover at ${width}px, ${locale}, ${theme}, ${coverState}; avatar y=${avatarBox.y}, cover bottom=${coverBottom}`).toBeLessThan(coverBottom);
              expect(avatarBox.y + avatarBox.height).toBeGreaterThan(coverBottom);
            }
            if (coverState === "default") {
              await expect(page.locator('[data-testid="cover-pattern-tile"]')).toBeVisible();
            } else {
              await expect(page.locator('[data-testid="cover-upload-image"]')).toBeVisible();
            }
            const header = page.locator('[data-testid="profile-header-card"]');
            const restingShadow = await header.evaluate((element) => getComputedStyle(element).boxShadow);
            expect(restingShadow, `profile header shadow is missing in ${locale}/${theme}`).not.toBe("none");
            await header.hover({ position: { x: 8, y: 8 } });
            expect(await header.evaluate((element) => getComputedStyle(element).boxShadow), `profile header shadow changes on hover in ${locale}/${theme}`).toBe(restingShadow);
            for (const infoBox of ["profile-glass-name", "profile-glass-details"]) {
              const box = page.locator(`[data-testid="${infoBox}"]`);
              await expect(box).toBeVisible();
              const styles = await box.evaluate((element) => {
                const style = getComputedStyle(element);
                const before = getComputedStyle(element, "::before");
                const after = getComputedStyle(element, "::after");
                return {
                  backdropFilter: style.backdropFilter,
                  borderWidth: style.borderWidth,
                  outlineStyle: style.outlineStyle,
                  boxShadow: style.boxShadow,
                  pseudoBorders: [before.borderWidth, after.borderWidth],
                  pseudoShadows: [before.boxShadow, after.boxShadow],
                };
              });
              expect(styles.backdropFilter).toContain("blur");
              expect(styles.borderWidth).toBe("0px");
              expect(styles.outlineStyle).toBe("none");
              const visibleBoxShadow = styles.boxShadow
                .replace(/rgba\(0, 0, 0, 0\)\s+0px 0px 0px 0px/g, "")
                .replaceAll(",", "")
                .trim();
              expect(visibleBoxShadow === "" || visibleBoxShadow === "none").toBe(true);
              expect(styles.pseudoBorders).toEqual(["0px", "0px"]);
              expect(styles.pseudoShadows).toEqual(["none", "none"]);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await header.screenshot({
              path: `evidence/task-05/t2/profile-${width}-${locale}-${theme}-${coverState}.png`,
            });
          }
        }

        if (coverState === "uploaded") {
          await page.goto(`${baseURL}/settings?tab=profile`);
          const preview = page.locator('[data-testid="settings-cover-preview"]');
          await expect(preview).toBeVisible();
          const previewBox = await preview.boundingBox();
          expect(previewBox).toBeTruthy();
          if (previewBox) {
            expect(previewBox.height).toBeCloseTo(width >= 640 ? 256 : 192, 0);
          }
          await page.locator('[data-testid="settings-profile-section"]').screenshot({
            path: `evidence/task-05/t2/settings-${width}-en-light-uploaded.png`,
          });
          await preview.locator('input[type="file"]').setInputFiles("public/images/gathering.jpg");
          await expect(page.locator('[data-testid="image-cropper-dialog"]')).toBeVisible();
          const actualAspect = Number(await page.locator('[data-testid="settings-profile-section"]').getAttribute("data-cover-crop-aspect"));
          expect(actualAspect).toBeCloseTo(profileAspectForWidth, 3);
        }
      }
    }
  } finally {
    assertDevBranchDatabase("Profile cover regression cleanup");
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await removeSyntheticUser(user.id);
  }
});
