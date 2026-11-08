import { test, expect, devices } from "@playwright/test";
import fs from "node:fs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

test.describe("Onboarding mobile input and shared footer", () => {
  test.setTimeout(600_000);
  test.beforeAll(() => fs.mkdirSync("evidence/task-2", { recursive: true }));

  test("age takes the first tap and footer actions fit at 320/360/390px across locales and themes", async ({ page, browser }) => {
    assertDevBranchDatabase("Onboarding mobile UI test");
    const user = await createSyntheticUser("Onboarding mobile UI test account");
    const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");

    try {
      await page.goto(`/login?callbackUrl=${encodeURIComponent("/onboarding")}`);
      await page.locator('[data-testid="login-email-input"]').fill(user.email);
      await page.locator('[data-testid="login-password-input"]').fill(user.password);
      await page.locator('[data-testid="login-submit-btn"]').click();
      await expect(page).toHaveURL(/\/onboarding/, { timeout: 20_000 });
      await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible();
      const storageState = await page.context().storageState();

      const deviceCases = [
        { name: "Pixel 5", descriptor: devices["Pixel 5"] },
        { name: "iPhone 13", descriptor: devices["iPhone 13"] },
        { name: "320px Android", descriptor: { viewport: { width: 320, height: 720 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
        { name: "360px Android", descriptor: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
        { name: "390px Android", descriptor: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
      ];

      for (const { name, descriptor } of deviceCases) {
        for (const locale of ["ar", "en"] as const) {
          for (const theme of ["light", "sunset", "amoled", "black"] as const) {
            const context = await browser.newContext({
              ...descriptor,
              baseURL,
              storageState,
              locale: locale === "ar" ? "ar-MA" : "en-US",
            });
          try {
            await context.addInitScript(({ localeValue, themeValue }) => {
              localStorage.setItem("ihyaa-locale", localeValue);
              localStorage.setItem("ihyaa-theme", themeValue);
            }, { localeValue: locale, themeValue: theme });
            const mobilePage = await context.newPage();
            await mobilePage.goto("/onboarding", { waitUntil: "domcontentloaded" });
            await expect(mobilePage.locator('[data-testid="onboarding-step-1"]')).toBeVisible();

            const age = mobilePage.locator('[data-testid="onboarding-age-input"]');
            const hitTest = await age.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              return {
                fontSize: getComputedStyle(element).fontSize,
                hitTestId: target?.getAttribute("data-testid"),
                activeBefore: (document.activeElement as HTMLElement | null)?.getAttribute("data-testid"),
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
              };
            });
            expect(hitTest.hitTestId, `${name} ${locale}: center tap target`).toBe("onboarding-age-input");
            expect(parseFloat(hitTest.fontSize), `${name} ${locale}: mobile text size`).toBeGreaterThanOrEqual(16);
            await mobilePage.touchscreen.tap(hitTest.x, hitTest.y);
            await expect.poll(() => mobilePage.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid"))).toBe("onboarding-age-input");

            const viewport = mobilePage.viewportSize();
            expect(viewport).toBeTruthy();
            const footer = mobilePage.locator('[data-testid="onboarding-step-footer"]');
            const primary = mobilePage.locator('[data-testid="onboarding-next-btn"]');
            const primaryBox = await primary.boundingBox();
            const footerBox = await footer.boundingBox();
            expect(primaryBox).toBeTruthy();
            expect(footerBox).toBeTruthy();
            if (viewport && primaryBox && footerBox && viewport.width < 520) {
              expect(Math.abs(primaryBox.width - footerBox.width)).toBeLessThanOrEqual(1);
            }
            expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport?.width ?? 400);

            await mobilePage.screenshot({ path: `evidence/task-2/onboarding-${name.replaceAll(" ", "-")}-${locale}-${theme}-${viewport?.width}-step1.png`, fullPage: true });

            if (theme === "light") {
              await age.fill("24");
              await mobilePage.locator('[data-testid="city-combobox-trigger"]').click();
              await mobilePage.locator('[data-testid="city-option-tetouan"]').click();
              await mobilePage.locator('[data-testid="onboarding-next-btn"]').click();
              await expect(mobilePage.locator('[data-testid="onboarding-step-2"]')).toBeVisible();

            const step2Footer = mobilePage.locator('[data-testid="onboarding-step-footer"]');
            const step2Primary = mobilePage.locator('[data-testid="onboarding-next-btn"]');
            const step2Back = mobilePage.locator('[data-testid="onboarding-back-btn"]');
            const step2Skip = mobilePage.locator('[data-testid="skip-photo-btn"]');
            const [step2PrimaryBox, backBox, skipBox, step2FooterBox] = await Promise.all([
              step2Primary.boundingBox(), step2Back.boundingBox(), step2Skip.boundingBox(), step2Footer.boundingBox(),
            ]);
            expect(step2PrimaryBox && backBox && skipBox && step2FooterBox).toBeTruthy();
            if (viewport && step2PrimaryBox && backBox && skipBox && step2FooterBox) {
              expect(step2PrimaryBox.height).toBeGreaterThanOrEqual(48);
              expect(backBox.height).toBe(step2PrimaryBox.height);
              expect(skipBox.height).toBe(step2PrimaryBox.height);
              expect(Math.abs(backBox.width - skipBox.width)).toBeLessThanOrEqual(1);
              if (viewport.width < 520) {
                expect(step2PrimaryBox.y + step2PrimaryBox.height).toBeLessThanOrEqual(backBox.y);
                expect(Math.abs(step2PrimaryBox.width - step2FooterBox.width)).toBeLessThanOrEqual(1);
              } else {
                expect(Math.abs(step2PrimaryBox.y - backBox.y)).toBeLessThanOrEqual(1);
              }
            }
            for (const button of [step2Back, step2Skip]) {
              const labelLineCount = await button.locator("span").evaluate((label) => {
                const range = document.createRange();
                range.selectNodeContents(label);
                return range.getClientRects().length;
              });
              expect(
                labelLineCount,
                `${name} ${locale}: footer label stays readable without narrow word columns`,
              ).toBeLessThanOrEqual((viewport?.width ?? 400) < 360 ? 2 : 1);
            }
            await mobilePage.screenshot({ path: `evidence/task-2/onboarding-${name.replaceAll(" ", "-")}-${locale}-${theme}-${viewport?.width}-step2.png`, fullPage: true });

            await mobilePage.locator('[data-testid="onboarding-next-btn"]').click();
            await expect(mobilePage.locator('[data-testid="onboarding-step-3"]')).toBeVisible();
            const submit = mobilePage.locator('[data-testid="onboarding-submit-btn"]');
            await expect(submit).toBeVisible();
            const submitLabelFits = await submit.evaluate((button) => {
              const span = button.querySelector("span");
              return !span || span.scrollWidth <= span.clientWidth;
            });
            expect(submitLabelFits, `${name} ${locale}: submit label fits`).toBe(true);
            }
          } finally {
            await context.close();
          }
          }
        }
      }
    } finally {
      assertDevBranchDatabase("Onboarding mobile UI test cleanup");
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await removeSyntheticUser(user.id);
    }
  });
});
