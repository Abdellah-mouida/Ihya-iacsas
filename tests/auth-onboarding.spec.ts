import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { clearRateLimit } from "../src/lib/rate-limit";

test.describe("Task 6: Onboarding Multi-step Flow & Server Enforcement", () => {
  test.setTimeout(60000);

  const testUserLoginEmail = "onboarding.login.test@ihyaa.org";
  const testUserStep1Email = "onboarding.step1.test@ihyaa.org";
  const testUserFlowEmail = "onboarding.flow.test@ihyaa.org";
  const testUserGoogleEmail = "onboarding.google.test@ihyaa.org";
  const testUserCompletedEmail = "onboarding.done.test@ihyaa.org";
  const testPassword = "OnboardPassword123!#";

  async function loginAsUser(
    page: import("@playwright/test").Page,
    email: string,
    pass: string,
    callbackUrl = "/events"
  ) {
    await clearRateLimit(`auth_login:${email}`);
    await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('[data-testid="login-email-input"]').fill(email);
    await page.locator('[data-testid="login-password-input"]').fill(pass);
    await page.locator('[data-testid="login-submit-btn"]').click();
    await expect(page).not.toHaveURL(/\/login(\?.*)?$/, { timeout: 20000 });
  }

  test.beforeAll(async () => {
    // Clean up old test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            testUserLoginEmail,
            testUserStep1Email,
            testUserFlowEmail,
            testUserGoogleEmail,
            testUserCompletedEmail,
          ],
        },
      },
    });

    await clearRateLimit(`auth_login:${testUserLoginEmail}`);
    await clearRateLimit(`auth_login:${testUserStep1Email}`);
    await clearRateLimit(`auth_login:${testUserFlowEmail}`);
    await clearRateLimit(`auth_login:${testUserGoogleEmail}`);
    await clearRateLimit(`auth_login:${testUserCompletedEmail}`);

    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. User for login route test
    await prisma.user.create({
      data: {
        email: testUserLoginEmail,
        name: "Onboard Login Tester",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: null,
        sessionVersion: 1,
      },
    });

    // 2. User for Step 1 validation test
    await prisma.user.create({
      data: {
        email: testUserStep1Email,
        name: "Onboard Step1 Tester",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: null,
        sessionVersion: 1,
      },
    });

    // 3. User for complete multi-step flow test
    await prisma.user.create({
      data: {
        email: testUserFlowEmail,
        name: "Onboard Flow Tester",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: null,
        sessionVersion: 1,
      },
    });

    // 4. Google-like user (terms NOT yet accepted, no onboarding)
    await prisma.user.create({
      data: {
        email: testUserGoogleEmail,
        name: "Google Onboard Tester",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: null,
        termsVersion: null,
        onboardingCompletedAt: null,
        sessionVersion: 1,
      },
    });

    // 5. User with completed onboarding
    await prisma.user.create({
      data: {
        email: testUserCompletedEmail,
        name: "Completed Onboard Tester",
        passwordHash,
        emailVerified: new Date(),
        city: "تطوان",
        age: 26,
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: new Date(),
        sessionVersion: 1,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            testUserLoginEmail,
            testUserStep1Email,
            testUserFlowEmail,
            testUserGoogleEmail,
            testUserCompletedEmail,
          ],
        },
      },
    });
  });

  test("1. Unauthenticated visitor accessing /onboarding is redirected to login", async ({
    page,
  }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("2. Logging in with incomplete onboarding routes to /onboarding", async ({
    page,
  }) => {
    await loginAsUser(page, testUserLoginEmail, testPassword);
    // Should be automatically routed to /onboarding
    await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 15000 });
    await expect(page.locator('[data-testid="onboarding-container"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="stepper-step-1"]')).toBeVisible();
  });

  test("3. Step 1 validation: requires city and valid age >= 10", async ({
    page,
  }) => {
    await loginAsUser(page, testUserStep1Email, testPassword);
    await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 15000 });
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible({
      timeout: 15000,
    });

    // Try submitting without city or age
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await expect(page.locator('[data-testid="error-city"]')).toBeVisible();

    // Enter invalid age (< 10)
    await page.locator('[data-testid="onboarding-age-input"]').fill("8");
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await expect(page.locator('[data-testid="error-age"]')).toBeVisible();

    // Select valid city from Moroccan cities combobox
    await page.locator('[data-testid="city-combobox-trigger"]').click();
    await expect(page.locator('[data-testid="city-search-input"]')).toBeVisible();
    await page.locator('[data-testid="city-search-input"]').fill("تطوان");
    await page.locator('[data-testid="city-option-tetouan"]').click();

    // Enter valid age
    await page.locator('[data-testid="onboarding-age-input"]').fill("22");

    // Click Next Step -> advances to Step 2
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test("4. Step 2 & Step 3 flow: back navigation preserves values, skip photo, and complete onboarding", async ({
    page,
  }) => {
    await loginAsUser(page, testUserFlowEmail, testPassword);
    await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 15000 });
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible({
      timeout: 15000,
    });

    // Fill Step 1
    await page.locator('[data-testid="city-combobox-trigger"]').click();
    await page.locator('[data-testid="city-search-input"]').fill("طنجة");
    await page.locator('[data-testid="city-option-tangier"]').click();
    await page.locator('[data-testid="onboarding-age-input"]').fill("25");
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    // In Step 2: verify elements
    await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="choose-photo-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="skip-photo-btn"]')).toBeVisible();

    // Test back button
    await page.locator('[data-testid="onboarding-back-btn"]').click();
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="onboarding-age-input"]')).toHaveValue("25");

    // Advance back to Step 2
    await page.locator('[data-testid="onboarding-next-btn"]').click();
    await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible();

    // Skip photo -> advances to Step 3
    await page.locator('[data-testid="skip-photo-btn"]').click();
    await expect(page.locator('[data-testid="onboarding-step-3"]')).toBeVisible();

    // Verify summary
    await expect(page.locator('[data-testid="onboarding-step-3"]')).toContainText("25");

    // Complete setup
    await page.locator('[data-testid="onboarding-submit-btn"]').click();

    // User is redirected to destination (/events)
    await expect(page).toHaveURL(/.*\/events/, { timeout: 15000 });

    // Verify database record was updated
    const updatedUser = await prisma.user.findUnique({
      where: { email: testUserFlowEmail },
    });
    expect(updatedUser?.onboardingCompletedAt).not.toBeNull();
    expect(updatedUser?.age).toBe(25);
    expect(updatedUser?.city).toBeTruthy();
  });

  test("5. Google user without terms acceptance requires terms checkbox on Step 3", async ({
    page,
  }) => {
    await loginAsUser(page, testUserGoogleEmail, testPassword);
    await expect(page).toHaveURL(/.*\/onboarding/, { timeout: 15000 });
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible({
      timeout: 15000,
    });

    // Fill Step 1
    await page.locator('[data-testid="city-combobox-trigger"]').click();
    await page.locator('[data-testid="city-search-input"]').fill("الرباط");
    await page.locator('[data-testid="city-option-rabat"]').click();
    await page.locator('[data-testid="onboarding-age-input"]').fill("21");
    await page.locator('[data-testid="onboarding-next-btn"]').click();

    // Step 2 -> Skip
    await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible();
    await page.locator('[data-testid="skip-photo-btn"]').click();

    // Step 3 -> Terms block is visible because user has not accepted terms yet
    await expect(page.locator('[data-testid="onboarding-step-3"]')).toBeVisible();
    await expect(page.locator('[data-testid="terms-agreement-block"]')).toBeVisible();

    // Submit button should be disabled until terms are checked
    const submitBtn = page.locator('[data-testid="onboarding-submit-btn"]');
    await expect(submitBtn).toBeDisabled();

    // Check terms
    await page.locator('[data-testid="onboarding-terms-checkbox"]').check();
    await expect(submitBtn).toBeEnabled();

    // Submit
    await submitBtn.click();
    await expect(page).toHaveURL(/.*\/events/, { timeout: 15000 });

    // Verify DB
    const updatedGoogleUser = await prisma.user.findUnique({
      where: { email: testUserGoogleEmail },
    });
    expect(updatedGoogleUser?.onboardingCompletedAt).not.toBeNull();
    expect(updatedGoogleUser?.termsAcceptedAt).not.toBeNull();
    expect(updatedGoogleUser?.termsVersion).toBe("2026-10-11");
  });

  test("6. User who already completed onboarding visiting /onboarding is redirected to /events", async ({
    page,
  }) => {
    await loginAsUser(page, testUserCompletedEmail, testPassword);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/.*\/events/, { timeout: 15000 });
  });
});
