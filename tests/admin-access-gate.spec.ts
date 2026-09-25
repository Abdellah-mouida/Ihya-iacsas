import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ihyaa-admin-dev-pass-2026";

test.describe("Admin Access Gate & Security Middleware", () => {
  test.beforeEach(async () => {
    // Reset rate limits for test client IP
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          contains: "admin_login_fail",
        },
      },
    });
  });

  test.afterAll(async () => {
    // Clean up test rate limit records
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          contains: "admin_login_fail",
        },
      },
    });
  });

  test("1. Unauthenticated visit to /admin redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator("h1")).toContainText(/Admin Access Gate|بوابة الإدارة/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("2. Unauthenticated visit to deep /admin route preserves next parameter", async ({ page }) => {
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fevents/);
  });

  test("3. Incorrect password is rejected with generic error", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[type="password"]', "completely-wrong-password");
    await page.click('button[type="submit"]');

    const error = page.getByTestId("admin-login-error");
    await expect(error).toBeVisible({ timeout: 15000 });
    await expect(error).toContainText(/Invalid password|كلمة المرور غير صحيحة/i);

    // Verify still on login page
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("4. Correct password grants access and persists across page reload", async ({ page }) => {
    await page.goto("/admin/login");
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Successfully navigated to /admin
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });

    // Reload page to verify session persistence
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
  });

  test("5. Navigating away to public site clears session immediately", async ({ page }) => {
    // 1. Log in to admin
    await page.goto("/admin/login");
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });

    // 2. Navigate to public homepage
    await page.goto("/");
    await expect(page).toHaveURL("/", { timeout: 15000 });

    // 3. Attempt to return to /admin - should be redirected to login because session was cleared
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });
  });

  test("6. Clicking Log Out revokes session and redirects to /admin/login", async ({ page }) => {
    // 1. Log in to admin
    await page.goto("/admin/login");
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });

    // 2. Click desktop logout button
    const logoutBtn = page.getByTestId("admin-logout-btn");
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });
    await logoutBtn.click();

    // 3. Redirected to /admin/login
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });

    // 4. Try directly visiting /admin again
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });
  });

  test("7. Repeated failed attempts trigger rate-limit lockout message", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/admin/login");

    // Perform 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.fill('input[type="password"]', `bad-attempt-${i}`);
      await page.click('button[type="submit"]');
      const error = page.getByTestId("admin-login-error");
      await expect(error).toBeVisible({ timeout: 10000 });
    }

    // 6th attempt should trigger rate-limit lockout
    await page.fill('input[type="password"]', "bad-attempt-final");
    await page.click('button[type="submit"]');

    const lockoutError = page.getByTestId("admin-login-error");
    await expect(lockoutError).toBeVisible({ timeout: 10000 });
    await expect(lockoutError).toContainText(/Too many failed login attempts|Account locked/i);
  });
});
