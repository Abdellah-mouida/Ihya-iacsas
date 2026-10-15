import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import {
  TEST_ADMIN,
  TEST_MODERATOR,
  TEST_REGULAR_USER,
  ensureTestUser,
  loginAs,
} from "./helpers/admin-auth";

test.describe("Task 7: Role-Based Admin Access & Permission Gate", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
    await ensureTestUser(TEST_MODERATOR);
    await ensureTestUser(TEST_REGULAR_USER);
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            TEST_ADMIN.email,
            TEST_MODERATOR.email,
            TEST_REGULAR_USER.email,
          ],
        },
      },
    });
  });

  test("1. Unauthenticated visit to /admin redirects to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test("2. Unauthenticated visit to deep /admin route preserves callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fevents/);
  });

  test("3. Legacy /admin/login redirects immediately to /login", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("4. USER role accessing /admin is redirected to /403 Forbidden", async ({
    page,
  }) => {
    await loginAs(page, TEST_REGULAR_USER, "/admin");
    await expect(page).toHaveURL(/\/403/);
    await expect(page.locator('[data-testid="page-forbidden"]')).toBeVisible({ timeout: 15000 });
  });

  test("5. ADMIN role access is granted with user card, role badge, and sidebar", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN, "/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 30000 });

    // Verify user card in sidebar
    await expect(page.locator("aside")).toContainText(TEST_ADMIN.fullName);
    await expect(page.locator("aside")).toContainText(/Admin|مسؤول/i);

    // Verify reload maintains access
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 30000 });
  });

  test("6. MODERATOR role can access events and bookings but blocked on users section", async ({
    page,
  }) => {
    await loginAs(page, TEST_MODERATOR, "/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 30000 });

    // Moderator role badge
    await expect(page.locator("aside")).toContainText(/Moderator|مشرف/i);

    // Can access events
    await page.goto("/admin/events");
    await expect(page).toHaveURL(/\/admin\/events/, { timeout: 30000 });

    // Can access bookings
    await page.goto("/admin/bookings");
    await expect(page).toHaveURL(/\/admin\/bookings/, { timeout: 30000 });

    // Blocked from /admin/users with 403
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/403/, { timeout: 30000 });
  });

  test("7. ADMIN sees Admin Portal in public navbar and session persists across public site", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, TEST_ADMIN, "/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });

    // Navigate to public home page
    await page.goto("/");
    await expect(page).toHaveURL("/", { timeout: 30000 });

    // Open user menu dropdown
    const userMenuBtn = page.locator('[data-testid="navbar-user-menu-btn"]');
    await expect(userMenuBtn).toBeVisible({ timeout: 15000 });
    await userMenuBtn.click();

    // Verify Admin Portal link is visible in dropdown
    const adminPortalLink = page.locator('[data-testid="navbar-admin-link"]');
    await expect(adminPortalLink).toBeVisible({ timeout: 10000 });

    // Click it and verify navigation back to /admin without needing re-login
    await adminPortalLink.click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
    await expect(page.locator("aside")).toBeVisible({ timeout: 30000 });
  });

  test("8. Clicking Log Out in admin revokes session and redirects to public home", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN, "/admin");
    await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });

    // Click desktop logout button
    const logoutBtn = page.getByTestId("admin-logout-btn");
    await expect(logoutBtn).toBeVisible({ timeout: 15000 });
    await logoutBtn.click();

    // Redirected to public home or login
    await expect(page).toHaveURL(/\/($|login)/, { timeout: 30000 });

    // Wait for session cookies to clear
    await page.waitForTimeout(1000);

    // Visiting /admin redirects to login
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/, { timeout: 15000 });
  });
});
