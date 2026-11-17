import { randomBytes } from "node:crypto";
import fs from "node:fs";

import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase, loginAs } from "./helpers/admin-auth";

const THEMES = ["light", "sunset", "amoled", "black"] as const;
const LOCALES = ["ar", "en"] as const;
const WIDTHS = [320, 360, 390, 768, 1440] as const;

test.describe("Responsive booking profile edit action", () => {
  test.setTimeout(300_000);

  test("keeps the account summary inside the card with a 44px action", async ({ page, browser }) => {
    assertDevBranchDatabase("Responsive booking edit action test");
    const suffix = randomBytes(16).toString("hex");
    const password = randomBytes(32).toString("base64url");
    const user = await prisma.user.create({
      data: {
        email: `booking-edit-${suffix}@example.test`,
        name: "Synthetic Booking Profile Member",
        city: "Synthetic City",
        age: 25,
        passwordHash: await bcrypt.hash(password, 12),
        emailVerified: new Date(),
        onboardingCompletedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        role: "USER",
      },
      select: { id: true, email: true },
    });

    try {
      await loginAs(page, { email: user.email!, password, role: "USER" }, "/events/majlis-ihyaa/book");
      const storageState = await page.context().storageState();
      const baseURL = String(test.info().project.use.baseURL || "http://localhost:3000");
      fs.mkdirSync("evidence/task-4", { recursive: true });

      for (const locale of LOCALES) {
        for (const theme of THEMES) {
          const context = await browser.newContext({
            baseURL,
            storageState,
            locale: locale === "ar" ? "ar-MA" : "en-US",
            viewport: { width: 320, height: 850 },
          });
          try {
            await context.addInitScript(({ localeValue, themeValue }) => {
              localStorage.setItem("ihyaa-locale", localeValue);
              localStorage.setItem("ihyaa-theme", themeValue);
            }, { localeValue: locale, themeValue: theme });
            const matrixPage = await context.newPage();

            for (const width of WIDTHS) {
              await matrixPage.setViewportSize({ width, height: width < 500 ? 850 : 1000 });
              await matrixPage.goto("/events/majlis-ihyaa/book", { waitUntil: "domcontentloaded" });
              const card = matrixPage.locator('[data-testid="account-snapshot-card"]');
              const action = card.locator('a[href="/settings?tab=profile"]');
              await expect(card).toBeVisible({ timeout: 30_000 });
              await expect(action).toBeVisible();

              const geometry = await matrixPage.evaluate(() => {
                const cardElement = document.querySelector('[data-testid="account-snapshot-card"]')!;
                const link = cardElement.querySelector('a[href="/settings?tab=profile"]')!;
                const shortLabel = link.querySelector(".sm\\:hidden")!;
                const fullLabel = link.querySelector(".hidden.sm\\:inline")!;
                const cardBounds = cardElement.getBoundingClientRect();
                const linkBounds = link.getBoundingClientRect();
                return {
                  card: { left: cardBounds.left, right: cardBounds.right },
                  link: { left: linkBounds.left, right: linkBounds.right, width: linkBounds.width, height: linkBounds.height },
                  shortVisible: getComputedStyle(shortLabel).display !== "none",
                  fullVisible: getComputedStyle(fullLabel).display !== "none",
                  scrollWidth: document.documentElement.scrollWidth,
                  direction: document.documentElement.dir,
                };
              });
              expect(geometry.link.width).toBeGreaterThanOrEqual(44);
              expect(geometry.link.height).toBeGreaterThanOrEqual(44);
              expect(geometry.link.left).toBeGreaterThanOrEqual(geometry.card.left);
              expect(geometry.link.right).toBeLessThanOrEqual(geometry.card.right);
              expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
              expect(geometry.shortVisible).toBe(width < 640);
              expect(geometry.fullVisible).toBe(width >= 640);
              expect(geometry.direction).toBe(locale === "ar" ? "rtl" : "ltr");

              await matrixPage.screenshot({
                path: `evidence/task-4/booking-edit-${width}-${theme}-${locale}.png`,
                fullPage: true,
              });
            }
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
