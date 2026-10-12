import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { clearRateLimit } from "../src/lib/rate-limit";

test.describe("Task 5: Forgot Password & Forced Change Password with Session Revocation", () => {
  test.setTimeout(60000);

  const resetTargetEmail = "forgot.target.test@ihyaa.org";
  const nonExistentEmail = "does.not.exist.999@ihyaa.org";
  const initialPassword = "InitialPassword123!";
  const tempPasswordDirect = "TempSecretPass123!";
  const newPermanentPassword = "BrandNewPassword2026!#";

  async function loginAsUser(
    page: import("@playwright/test").Page,
    email: string,
    pass: string,
  ) {
    await clearRateLimit(`auth_login:${email}`);
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({
      timeout: 15000,
    });
    await page.locator('[data-testid="login-email-input"]').fill(email);
    await page.locator('[data-testid="login-password-input"]').fill(pass);
    await page.locator('[data-testid="login-submit-btn"]').click();
  }

  test.beforeAll(async () => {
    // Clean up old test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [resetTargetEmail, nonExistentEmail],
        },
      },
    });

    await clearRateLimit(`forgot_email_${resetTargetEmail}`);
    await clearRateLimit(`forgot_email_${nonExistentEmail}`);
    await clearRateLimit(`auth_login:${resetTargetEmail}`);

    const passwordHash = await bcrypt.hash(initialPassword, 10);

    // Create verified test user
    await prisma.user.create({
      data: {
        email: resetTargetEmail,
        name: "Forgot Target User",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        sessionVersion: 1,
        mustChangePassword: false,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [resetTargetEmail, nonExistentEmail],
        },
      },
    });
  });

  test("1. Forgot password page renders required elements", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.locator('[data-testid="forgot-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-submit-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="back-to-login-link"]')).toBeVisible();

    // Verify back to login navigation
    await page.locator('[data-testid="back-to-login-link"]').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("2. Non-existent email shows generic success without revealing account non-existence", async ({
    page,
  }) => {
    await page.goto("/forgot-password");

    await page.locator('[data-testid="forgot-email-input"]').fill(nonExistentEmail);
    await page.locator('[data-testid="forgot-submit-btn"]').click();

    // Must show success card to prevent account enumeration
    await expect(page.locator('[data-testid="forgot-success-card"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="forgot-success-card"]')).toContainText(
      nonExistentEmail,
    );

    // Verify user was NOT created in DB
    const dbUser = await prisma.user.findUnique({
      where: { email: nonExistentEmail },
    });
    expect(dbUser).toBeNull();
  });

  test("3. Requesting reset for existing verified user generates temporary password in DB", async ({
    page,
  }) => {
    await clearRateLimit(`forgot_email_${resetTargetEmail}`);
    await page.goto("/forgot-password");

    await page.locator('[data-testid="forgot-email-input"]').fill(resetTargetEmail);
    await page.locator('[data-testid="forgot-submit-btn"]').click();

    await expect(page.locator('[data-testid="forgot-success-card"]')).toBeVisible({
      timeout: 25000,
    });

    // Check DB: tempPasswordHash must be set, tempPasswordExpiresAt in future, mustChangePassword true
    const user = await prisma.user.findUnique({
      where: { email: resetTargetEmail },
    });

    expect(user).not.toBeNull();
    expect(user?.tempPasswordHash).toBeTruthy();
    expect(user?.tempPasswordExpiresAt).toBeTruthy();
    expect(user!.tempPasswordExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(user?.mustChangePassword).toBe(true);
  });

  test("4. Logging in with temporary password directs user to /change-password with forced notice", async ({
    page,
  }) => {
    // Set known temporary password hash directly in DB for deterministic login
    const tempHash = await bcrypt.hash(tempPasswordDirect, 10);
    await prisma.user.update({
      where: { email: resetTargetEmail },
      data: {
        tempPasswordHash: tempHash,
        tempPasswordExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        mustChangePassword: true,
      },
    });

    await clearRateLimit(`auth_login:${resetTargetEmail}`);

    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(resetTargetEmail);
    await page.locator('[data-testid="login-password-input"]').fill(tempPasswordDirect);
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Must redirect to /change-password
    await expect(page).toHaveURL(/\/change-password/, { timeout: 15000 });

    // Must show the mustChangePasswordNotice alert
    await expect(
      page.locator('[data-testid="must-change-password-alert"]'),
    ).toBeVisible();

    // Verify required form elements
    await expect(
      page.locator('[data-testid="current-password-input"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="new-password-input"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="confirm-new-password-input"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="change-password-submit-btn"]'),
    ).toBeVisible();
  });

  test("5. Submitting wrong current password or identical new password displays appropriate errors", async ({
    page,
  }) => {
    // Log in with temporary password first
    const tempHash = await bcrypt.hash(tempPasswordDirect, 10);
    await prisma.user.update({
      where: { email: resetTargetEmail },
      data: {
        tempPasswordHash: tempHash,
        tempPasswordExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        mustChangePassword: true,
      },
    });

    await loginAsUser(page, resetTargetEmail, tempPasswordDirect);
    await expect(page).toHaveURL(/\/change-password/, { timeout: 15000 });

    // 1. Wrong current password
    await page
      .locator('[data-testid="current-password-input"]')
      .fill("WrongTempPass123!");
    await page
      .locator('[data-testid="new-password-input"]')
      .fill(newPermanentPassword);
    await page
      .locator('[data-testid="confirm-new-password-input"]')
      .fill(newPermanentPassword);
    await page.locator('[data-testid="change-password-submit-btn"]').click();

    await expect(
      page.locator('[data-testid="change-password-error-banner"]'),
    ).toBeVisible({ timeout: 10000 });

    // 2. New password identical to temporary password
    await page
      .locator('[data-testid="current-password-input"]')
      .fill(tempPasswordDirect);
    await page
      .locator('[data-testid="new-password-input"]')
      .fill(tempPasswordDirect);
    await page
      .locator('[data-testid="confirm-new-password-input"]')
      .fill(tempPasswordDirect);
    await page.locator('[data-testid="change-password-submit-btn"]').click();

    await expect(
      page.locator('[data-testid="change-password-error-banner"]'),
    ).toBeVisible();
  });

  test("6. Changing password sets permanent password, clears temp password, increments sessionVersion, and completes flow", async ({
    page,
  }) => {
    // Log in with temporary password first
    const tempHash = await bcrypt.hash(tempPasswordDirect, 10);
    await prisma.user.update({
      where: { email: resetTargetEmail },
      data: {
        tempPasswordHash: tempHash,
        tempPasswordExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        mustChangePassword: true,
      },
    });

    await loginAsUser(page, resetTargetEmail, tempPasswordDirect);
    await expect(page).toHaveURL(/\/change-password/, { timeout: 15000 });

    await page
      .locator('[data-testid="current-password-input"]')
      .fill(tempPasswordDirect);
    await page
      .locator('[data-testid="new-password-input"]')
      .fill(newPermanentPassword);
    await page
      .locator('[data-testid="confirm-new-password-input"]')
      .fill(newPermanentPassword);

    await page.locator('[data-testid="change-password-submit-btn"]').click();

    // Wait for redirect to onboarding or account
    await expect(page).toHaveURL(/\/(onboarding|account)/, { timeout: 15000 });

    // Check DB: mustChangePassword === false, tempPasswordHash === null, sessionVersion incremented to 2
    const updatedUser = await prisma.user.findUnique({
      where: { email: resetTargetEmail },
    });

    expect(updatedUser?.mustChangePassword).toBe(false);
    expect(updatedUser?.tempPasswordHash).toBeNull();
    expect(updatedUser?.tempPasswordExpiresAt).toBeNull();
    expect(updatedUser?.sessionVersion).toBe(2);

    // Verify user can now log in with the new permanent password
    const isNewPassValid = await bcrypt.compare(
      newPermanentPassword,
      updatedUser!.passwordHash!,
    );
    expect(isNewPassValid).toBe(true);
  });

  test("7. Incremented sessionVersion revokes active session on another device/browser", async ({
    page,
  }) => {
    // 1. Log in with the new permanent password
    await loginAsUser(page, resetTargetEmail, newPermanentPassword);
    await expect(page).toHaveURL(/\/(onboarding|account|events)/, {
      timeout: 15000,
    });

    // 2. Simulate another device or admin revoking sessions by bumping sessionVersion to 3 in DB
    await prisma.user.update({
      where: { email: resetTargetEmail },
      data: { sessionVersion: 3 },
    });

    // 3. Query /api/auth/session - token check against DB should return null user (session revoked)
    const sessionRes = await page.request.get("/api/auth/session");
    const sessionData = await sessionRes.json();
    expect(sessionData?.user).toBeUndefined();
  });
});
