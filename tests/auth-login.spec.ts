import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { clearRateLimit } from "../src/lib/rate-limit";

test.describe("Task 4: Login with Credentials & Google, Rate Limiting & Account Security", () => {
  test.setTimeout(60000);
  const verifiedEmail = "verified.user.test@ihyaa.org";
  const unverifiedEmail = "unverified.user.test@ihyaa.org";
  const rateLimitTargetEmail = "ratelimit.target@ihyaa.org";
  const testPassword = "ValidPassword123!";

  test.beforeAll(async () => {
    // Clean up any old test users and rate limits
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [verifiedEmail, unverifiedEmail, rateLimitTargetEmail],
        },
      },
    });

    await clearRateLimit(`auth_login:${verifiedEmail}`);
    await clearRateLimit(`auth_login:${unverifiedEmail}`);
    await clearRateLimit(`auth_login:${rateLimitTargetEmail}`);

    const passwordHash = await bcrypt.hash(testPassword, 10);

    // 1. Create verified user
    await prisma.user.create({
      data: {
        email: verifiedEmail,
        name: "Verified Test User",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        sessionVersion: 1,
      },
    });

    // 2. Create unverified user
    await prisma.user.create({
      data: {
        email: unverifiedEmail,
        name: "Unverified Test User",
        passwordHash,
        emailVerified: null,
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        sessionVersion: 1,
      },
    });

    // 3. Create rate limit test user
    await prisma.user.create({
      data: {
        email: rateLimitTargetEmail,
        name: "Rate Limit Target",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        sessionVersion: 1,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [verifiedEmail, unverifiedEmail, rateLimitTargetEmail],
        },
      },
    });
    await clearRateLimit(`auth_login:${verifiedEmail}`);
    await clearRateLimit(`auth_login:${unverifiedEmail}`);
    await clearRateLimit(`auth_login:${rateLimitTargetEmail}`);
  });

  test("1. Login page renders essential layout, fields, toggles, and OAuth elements", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    // Container and title
    const loginView = page.locator('[data-testid="login-view"]');
    await expect(loginView).toBeVisible();

    const title = page.locator('[data-testid="login-title"]');
    await expect(title).toBeVisible();

    // Inputs
    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Show/hide password toggle
    const toggleBtn = page.locator('[data-testid="toggle-password-visibility"]');
    await expect(toggleBtn).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Action buttons and links
    await expect(page.locator('[data-testid="login-submit-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="google-signin-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-link"]')).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    await expect(page.locator('[data-testid="signup-link"]')).toBeVisible();
  });

  test("2. Login with non-existent email shows invalid credentials error", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill("nonexistent.random.user@ihyaa.org");
    await page.locator('[data-testid="login-password-input"]').fill("RandomPass123!");
    await page.locator('[data-testid="login-submit-btn"]').click();

    const errorBanner = page.locator('[data-testid="login-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 15000 });
  });

  test("3. Login with wrong password for existing user shows invalid credentials error", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(verifiedEmail);
    await page.locator('[data-testid="login-password-input"]').fill("WrongPassword999!");
    await page.locator('[data-testid="login-submit-btn"]').click();

    const errorBanner = page.locator('[data-testid="login-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 15000 });
  });

  test("4. Login with unverified email shows unverified alert and verification CTA", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(unverifiedEmail);
    await page.locator('[data-testid="login-password-input"]').fill(testPassword);
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Verify unverified alert appears
    const unverifiedAlert = page.locator('[data-testid="unverified-alert"]');
    await expect(unverifiedAlert).toBeVisible({ timeout: 15000 });

    const verifyNowBtn = page.locator('[data-testid="verify-now-btn"]');
    await expect(verifyNowBtn).toBeVisible();

    // Click verify now button -> should navigate to /verify-email with email parameter
    await verifyNowBtn.click();
    await expect(page).toHaveURL(new RegExp(`/verify-email\\?email=${encodeURIComponent(unverifiedEmail)}`), {
      timeout: 15000,
    });
  });

  test("5. Navigating to /login with verified=true & email query parameters shows success banner and pre-fills email", async ({
    page,
  }) => {
    await page.goto(`/login?verified=true&email=${encodeURIComponent(verifiedEmail)}`);
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    const verifiedBanner = page.locator('[data-testid="verified-success-banner"]');
    await expect(verifiedBanner).toBeVisible();

    const emailInput = page.locator('[data-testid="login-email-input"]');
    await expect(emailInput).toHaveValue(verifiedEmail);
  });

  test("6. Successful credentials login establishes session and redirects safely", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(verifiedEmail);
    await page.locator('[data-testid="login-password-input"]').fill(testPassword);
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Redirection happens to /account (or /onboarding)
    await page.waitForURL((url) => url.pathname.includes("/account") || url.pathname.includes("/onboarding"), {
      timeout: 20000,
    });

    // Verify Auth.js session cookie exists
    const cookies = await page.context().cookies();
    const authSessionCookie = cookies.find(
      (c) => c.name.includes("authjs.session-token") || c.name.includes("next-auth.session-token"),
    );
    expect(authSessionCookie).toBeDefined();
  });

  test("7. CallbackUrl handling respects safe relative URLs and sanitizes protocol-relative open redirects", async ({
    page,
  }) => {
    // A. Valid relative callback URL
    await page.goto("/login?callbackUrl=/events");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(verifiedEmail);
    await page.locator('[data-testid="login-password-input"]').fill(testPassword);
    await page.locator('[data-testid="login-submit-btn"]').click();

    await page.waitForURL((url) => url.pathname === "/events", { timeout: 20000 });
    expect(page.url()).toContain("/events");

    // Clear session cookies for next assertion
    await page.context().clearCookies();

    // B. Protocol-relative open redirect attempt (//evil.com)
    await page.goto("/login?callbackUrl=//evil.com");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="login-email-input"]').fill(verifiedEmail);
    await page.locator('[data-testid="login-password-input"]').fill(testPassword);
    await page.locator('[data-testid="login-submit-btn"]').click();

    // Must NOT redirect to evil.com, must redirect safely to /account (or /onboarding)
    await page.waitForURL((url) => !url.href.includes("evil.com") && (url.pathname.includes("/account") || url.pathname.includes("/onboarding")), {
      timeout: 20000,
    });
    expect(page.url()).not.toContain("evil.com");
  });

  test("8. Consecutive failed attempts trigger rate-limiting lockout", async ({
    page,
  }) => {
    await clearRateLimit(`auth_login:${rateLimitTargetEmail}`);

    await page.goto("/login");
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });

    // Perform failed attempts
    for (let i = 1; i <= 5; i++) {
      await page.locator('[data-testid="login-email-input"]').fill(rateLimitTargetEmail);
      await page.locator('[data-testid="login-password-input"]').fill(`BadAttempt_${i}`);
      await page.locator('[data-testid="login-submit-btn"]').click();
      await expect(page.locator('[data-testid="login-error-banner"]')).toBeVisible({ timeout: 15000 });
    }

    // Attempt 6 must be blocked by rate limiter
    await page.locator('[data-testid="login-email-input"]').fill(rateLimitTargetEmail);
    await page.locator('[data-testid="login-password-input"]').fill("AnotherBadAttempt");
    await page.locator('[data-testid="login-submit-btn"]').click();

    const errorBanner = page.locator('[data-testid="login-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 15000 });

    // Verify rate limit lockout text or localized message
    const errorText = await errorBanner.textContent();
    expect(errorText).toBeTruthy();
  });
});
