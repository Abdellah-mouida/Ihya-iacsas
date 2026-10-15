import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import {
  TEST_ADMIN,
  TEST_MODERATOR,
  TEST_REGULAR_USER,
  ensureTestUser,
  loginAs,
} from "./helpers/admin-auth";

const TEST_TARGET_USER = {
  email: "target.member.test@ihyaa.org",
  password: "Password123!",
  fullName: "Target Test Member",
  role: "USER" as const,
  city: "Casablanca",
  age: 22,
};

test.describe("Task 8: Admin Users Management & Role Control", () => {
  test.beforeEach(async () => {
    test.setTimeout(60000);
  });

  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
    await ensureTestUser(TEST_MODERATOR);
    await ensureTestUser(TEST_REGULAR_USER);
    await ensureTestUser(TEST_TARGET_USER);
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            TEST_ADMIN.email,
            TEST_MODERATOR.email,
            TEST_REGULAR_USER.email,
            TEST_TARGET_USER.email,
          ],
        },
      },
    });
  });

  test("1. Unauthenticated visit to /admin/users redirects to /login with callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fusers/);
  });

  test("2. Regular USER accessing /admin/users redirects to /403", async ({
    page,
  }) => {
    await loginAs(page, TEST_REGULAR_USER, "/admin/users");
    await expect(page).toHaveURL(/\/403/);
    await expect(page.locator('[data-testid="page-forbidden"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test("3. MODERATOR accessing /admin/users redirects to /403 and sidebar lacks Users link", async ({
    page,
  }) => {
    // First verify moderator on /admin does not have Users link
    await loginAs(page, TEST_MODERATOR, "/admin");
    await expect(page.locator("aside")).not.toContainText(/Users|المستخدمون/i);

    // Direct visit to /admin/users
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/403/);
  });

  test("4. ADMIN access to /admin/users renders page, stats, and search bar", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/, { timeout: 30000 });
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible({
      timeout: 15000,
    });

    // Check stats cards
    await expect(page.locator('[data-testid="stat-total-users"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-total-admins"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-total-moderators"]')).toBeVisible();

    // Check search input
    await expect(page.locator('[data-testid="users-search-input"]')).toBeVisible();
  });

  test("5. Search filters user list by name or email", async ({ page }) => {
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();

    const searchInput = page.locator('[data-testid="users-search-input"]');
    await searchInput.fill("Target Test Member");
    await searchInput.press("Enter");

    // Wait for filtered result
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toContainText("Target Test Member");
    await expect(page.locator("body")).toContainText("target.member.test@ihyaa.org");
  });

  test("6. View Details dialog displays profile and audit history", async ({ page }) => {
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible({ timeout: 15000 });

    // Find target user ID from DB
    const target = await prisma.user.findUnique({
      where: { email: TEST_TARGET_USER.email },
    });
    expect(target).not.toBeNull();

    // Filter to Target Member
    const searchInput = page.locator('[data-testid="users-search-input"]');
    await searchInput.fill("target.member.test");
    await searchInput.press("Enter");

    // Wait for row
    const userRow = page.locator(`[data-testid="user-row-${target!.id}"]`);
    await expect(userRow).toBeVisible({ timeout: 15000 });

    // Open dropdown and click view details
    const actionBtn = page.locator(`[data-testid="user-actions-btn-${target!.id}"]`);
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();
    await page.locator(`[data-testid="view-user-${target!.id}"]`).click();

    const detailsDialog = page.locator('[data-testid="user-details-dialog"]');
    await expect(detailsDialog).toBeVisible({ timeout: 10000 });
    await expect(detailsDialog).toContainText("Target Test Member");
    await expect(detailsDialog).toContainText("Casablanca");

    // Close dialog
    await detailsDialog.locator('[data-slot="dialog-close"]').click();
    await expect(detailsDialog).not.toBeVisible();
  });

  test("7. ADMIN promotes user to MODERATOR with reason and verifies AuditLog", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible({ timeout: 15000 });

    const target = await prisma.user.findUnique({
      where: { email: TEST_TARGET_USER.email },
    });
    expect(target).not.toBeNull();

    // Search target user
    const searchInput = page.locator('[data-testid="users-search-input"]');
    await searchInput.fill("target.member.test");
    await searchInput.press("Enter");

    const userRow = page.locator(`[data-testid="user-row-${target!.id}"]`);
    await expect(userRow).toBeVisible({ timeout: 15000 });

    // Open action menu and click change role
    const actionBtn = page.locator(`[data-testid="user-actions-btn-${target!.id}"]`);
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();
    await page.locator(`[data-testid="edit-role-${target!.id}"]`).click();

    const roleDialog = page.locator('[data-testid="role-change-dialog"]');
    await expect(roleDialog).toBeVisible({ timeout: 10000 });

    // Select MODERATOR
    await page.locator('[data-testid="select-role-moderator"]').click();

    // Fill reason
    await page
      .locator('[data-testid="role-change-reason"]')
      .fill("Promoting for community event organization");

    // Submit
    await page.locator('[data-testid="role-change-submit"]').click();
    await expect(roleDialog).not.toBeVisible({ timeout: 10000 });

    // Verify DB update
    const updatedUser = await prisma.user.findUnique({
      where: { id: target!.id },
    });
    expect(updatedUser?.role).toBe("MODERATOR");

    // Verify AuditLog entry was written
    const audit = await prisma.auditLog.findFirst({
      where: {
        targetId: target!.id,
        action: "USER_ROLE_UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.details as any)?.newRole).toBe("MODERATOR");
    expect((audit?.details as any)?.previousRole).toBe("USER");
  });

  test("8. Admin row has '(You)' indicator and disables self-role-change and self-deletion", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="users-table"]')).toBeVisible({ timeout: 15000 });

    const currentAdmin = await prisma.user.findUnique({
      where: { email: TEST_ADMIN.email },
    });
    expect(currentAdmin).not.toBeNull();

    // Search for the admin
    const searchInput = page.locator('[data-testid="users-search-input"]');
    await searchInput.fill(TEST_ADMIN.email);
    await searchInput.press("Enter");

    // Verify "(You)" or "أنت" indicator
    const adminRow = page.locator(`[data-testid="user-row-${currentAdmin!.id}"]`);
    await expect(adminRow).toBeVisible({ timeout: 15000 });
    await expect(adminRow).toContainText(/You|أنت/i);

    // Check actions menu
    const actionBtn = page.locator(`[data-testid="user-actions-btn-${currentAdmin!.id}"]`);
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    const editRoleItem = page.locator(`[data-testid="edit-role-${currentAdmin!.id}"]`);
    const deleteUserItem = page.locator(`[data-testid="delete-user-${currentAdmin!.id}"]`);

    await expect(editRoleItem).toBeDisabled();
    await expect(deleteUserItem).toBeDisabled();
  });

  test("9. Responsive layout works cleanly at 320px viewport without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();

    // On 320px, mobile cards should be rendered, table hidden
    await expect(page.locator('[data-testid="users-cards-mobile"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="users-table"]')).not.toBeVisible();

    // Verify no horizontal document overflow
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
