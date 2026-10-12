import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

test.describe("Task 8: Navbar Auth State & Entry Points", () => {
  const testUser = {
    email: "navbar.user.test@ihyaa.test",
    password: "Password123!",
    fullName: "طارق الإدريسي",
    city: "Casablanca",
    age: 24,
  };

  test.beforeAll(async () => {
    // Clean up any previous test user
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });

    // Create a verified onboarded test user
    const passwordHash = await bcrypt.hash(testUser.password, 12);
    await prisma.user.create({
      data: {
        email: testUser.email,
        name: testUser.fullName,
        passwordHash,
        city: testUser.city,
        age: testUser.age,
        emailVerified: new Date(),
        onboardingCompletedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        sessionVersion: 1,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });
  });

  test("1. Unauthenticated desktop visitor sees login and signup buttons, no user menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    // Verify desktop login and signup buttons are visible
    const loginBtn = page.locator('[data-testid="navbar-login-btn"]');
    const signupBtn = page.locator('[data-testid="navbar-signup-btn"]');
    await expect(loginBtn).toBeVisible({ timeout: 10000 });
    await expect(signupBtn).toBeVisible({ timeout: 10000 });

    // Verify user menu button is NOT visible
    const userMenuBtn = page.locator('[data-testid="navbar-user-menu-btn"]');
    await expect(userMenuBtn).not.toBeVisible();

    // Clicking login button navigates to /login
    await loginBtn.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("2. Unauthenticated mobile visitor sees login and signup in hamburger menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");

    // Open hamburger menu
    const menuBtn = page.locator('button[aria-label="القائمة"], button[aria-label="Menu"]');
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
    await menuBtn.click();

    // Mobile auth buttons visible in open menu
    const mobileLoginBtn = page.locator('[data-testid="navbar-mobile-login-btn"]');
    const mobileSignupBtn = page.locator('[data-testid="navbar-mobile-signup-btn"]');
    await expect(mobileLoginBtn).toBeVisible({ timeout: 10000 });
    await expect(mobileSignupBtn).toBeVisible({ timeout: 10000 });

    // User profile and logout NOT present
    await expect(page.locator('[data-testid="navbar-mobile-account-link"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="navbar-mobile-logout-btn"]')).not.toBeVisible();
  });

  test("3. Authenticated desktop visitor sees avatar menu, dropdown items, and navigates to account", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Log in first
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUser.email);
    await page.fill('[data-testid="login-password-input"]', testUser.password);
    await page.click('[data-testid="login-submit-btn"]');

    // Wait for redirect to /account
    await page.waitForURL((url) => url.pathname.includes("/account") || url.pathname.includes("/onboarding"), {
      timeout: 20000,
    });
    await page.goto("/");

    // User menu button should be visible
    const userMenuBtn = page.locator('[data-testid="navbar-user-menu-btn"]');
    await expect(userMenuBtn).toBeVisible({ timeout: 10000 });

    // Login and signup buttons should NOT be visible
    await expect(page.locator('[data-testid="navbar-login-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="navbar-signup-btn"]')).not.toBeVisible();

    // Click user menu button to open dropdown
    await userMenuBtn.click();

    // Verify user info and menu items
    const accountLink = page.locator('[data-testid="navbar-account-link"]');
    const bookingsLink = page.locator('[data-testid="navbar-bookings-link"]');
    const logoutBtn = page.locator('[data-testid="navbar-logout-btn"]');

    await expect(accountLink).toBeVisible();
    await expect(bookingsLink).toBeVisible();
    await expect(logoutBtn).toBeVisible();
    await expect(page.getByText(testUser.email)).toBeVisible();

    // Clicking account link navigates to /account
    await accountLink.click();
    await expect(page).toHaveURL(/\/account/);
  });

  test("4. Authenticated mobile visitor sees user card and logout in hamburger menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Log in first
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUser.email);
    await page.fill('[data-testid="login-password-input"]', testUser.password);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname.includes("/account") || url.pathname.includes("/onboarding"), {
      timeout: 20000,
    });

    // Go to homepage
    await page.goto("/");

    // Open hamburger menu
    const menuBtn = page.locator('button[aria-label="القائمة"], button[aria-label="Menu"]');
    await expect(menuBtn).toBeVisible({ timeout: 10000 });
    await menuBtn.click();

    // Mobile user profile card is visible
    const mobileAccountLink = page.locator('[data-testid="navbar-mobile-account-link"]');
    await expect(mobileAccountLink).toBeVisible({ timeout: 10000 });
    await expect(mobileAccountLink.getByText(testUser.fullName)).toBeVisible();
    await expect(mobileAccountLink.getByText(testUser.email)).toBeVisible();

    // Mobile logout button is visible
    const mobileLogoutBtn = page.locator('[data-testid="navbar-mobile-logout-btn"]');
    await expect(mobileLogoutBtn).toBeVisible({ timeout: 10000 });

    // Mobile login and signup should NOT be visible
    await expect(page.locator('[data-testid="navbar-mobile-login-btn"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="navbar-mobile-signup-btn"]')).not.toBeVisible();
  });

  test("5. Logging out from navbar dropdown terminates session and restores unauthenticated state", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Log in first
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUser.email);
    await page.fill('[data-testid="login-password-input"]', testUser.password);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL((url) => url.pathname.includes("/account") || url.pathname.includes("/onboarding"), {
      timeout: 20000,
    });

    // Navigate to homepage
    await page.goto("/");
    const userMenuBtn = page.locator('[data-testid="navbar-user-menu-btn"]');
    await expect(userMenuBtn).toBeVisible({ timeout: 10000 });

    // Open dropdown and click logout
    await userMenuBtn.click();
    const logoutBtn = page.locator('[data-testid="navbar-logout-btn"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // SignOut redirects to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // Navigate back to /
    await page.goto("/");

    // Unauthenticated login and signup buttons are restored
    await expect(page.locator('[data-testid="navbar-login-btn"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="navbar-signup-btn"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="navbar-user-menu-btn"]')).not.toBeVisible();
  });
});
