import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

test.describe("Mandatory onboarding", () => {
  test.setTimeout(180_000);

  test("redirects an incomplete sign-in, requires terms, and returns to its callback", async ({ page }) => {
    assertDevBranchDatabase("Mandatory onboarding E2E");
    const suffix = randomBytes(16).toString("hex");
    const email = `onboarding-required-${suffix}@example.test`;
    const password = randomBytes(32).toString("base64url");
    const user = await prisma.user.create({
      data: {
        email,
        name: "Synthetic Incomplete Member",
        passwordHash: await bcrypt.hash(password, 12),
        emailVerified: new Date(),
        onboardingCompletedAt: null,
        termsAcceptedAt: null,
        role: "USER",
      },
      select: { id: true },
    });

    try {
      await page.goto("/login?callbackUrl=%2Fprofile%3Ftab%3Dbookings");
      await page.fill('[data-testid="login-email-input"]', email);
      await page.fill('[data-testid="login-password-input"]', password);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/onboarding", { timeout: 30_000 }),
        page.click('[data-testid="login-submit-btn"]'),
      ]);

      await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible();
      expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/profile?tab=bookings");
      await page.locator('[data-testid="city-combobox-trigger"]').click();
      await page.locator('[data-testid="city-search-input"]').fill("Casablanca");
      await page.getByRole("option").first().click();
      await page.locator('[data-testid="onboarding-age-input"]').fill("25");
      await page.locator('[data-testid="onboarding-next-btn"]').click();
      await page.locator('[data-testid="skip-photo-btn"]').click();

      await expect(page.locator('[data-testid="terms-agreement-block"]')).toBeVisible();
      const submit = page.locator('[data-testid="onboarding-submit-btn"]');
      await expect(submit).toBeDisabled();
      await page.locator('[data-testid="onboarding-terms-checkbox"]').check();
      await expect(submit).toBeEnabled();
      await submit.click();
      await page.waitForURL((url) => url.pathname === "/profile" && url.searchParams.get("tab") === "bookings", { timeout: 30_000 });

      const savedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { onboardingCompletedAt: true, termsAcceptedAt: true },
      });
      expect(savedUser?.onboardingCompletedAt).not.toBeNull();
      expect(savedUser?.termsAcceptedAt).not.toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
