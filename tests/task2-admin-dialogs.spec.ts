import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAs, TEST_ADMIN } from "./helpers/admin-auth";

test.describe("Task 2: Admin Dialog Centering, Backdrop Blur & Subtle Pattern", () => {
  test.setTimeout(90000);

  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
  });

  test("User Profile Details & Change User Role dialogs are centered with backdrop blur", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);

    // Wait for the users table to load
    const userRow = page.locator("table tbody tr").first();
    await expect(userRow).toBeVisible({ timeout: 15000 });

    // Open user actions dropdown menu first
    const actionBtn = page.locator('button[data-testid^="user-actions-btn-"]').first();
    await actionBtn.click();

    // Click View Details menu item
    const viewItem = page.locator('div[role="menuitem"][data-testid^="view-user-"]').first();
    await viewItem.click();

    const detailsDialog = page.locator('[data-testid="user-details-dialog"]');
    await expect(detailsDialog).toBeVisible({ timeout: 10000 });

    // Verify dialog centering:
    // With viewport 1440x900, check the dialog's bounding box
    const detailsBox = await detailsDialog.boundingBox();
    expect(detailsBox).not.toBeNull();
    if (detailsBox) {
      const dialogCenterX = detailsBox.x + detailsBox.width / 2;
      const dialogCenterY = detailsBox.y + detailsBox.height / 2;
      const viewportCenterX = 1440 / 2;
      const viewportCenterY = 900 / 2;

      // Center should be within 10px of the viewport center (accounts for subpixel rendering and scrollbar width)
      expect(Math.abs(dialogCenterX - viewportCenterX)).toBeLessThanOrEqual(10);
      expect(Math.abs(dialogCenterY - viewportCenterY)).toBeLessThanOrEqual(10);
    }

    // Verify backdrop overlay has backdrop-blur
    const overlay = page.locator('[data-slot="dialog-overlay"]');
    await expect(overlay).toBeVisible();
    const overlayBlur = await overlay.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.backdropFilter || (style as unknown as Record<string, string>)["webkitBackdropFilter"] || "";
    });
    expect(overlayBlur).toContain("blur");

    // Verify subtle pattern layer inside dialog has opacity <= 0.06
    const patternLayer = detailsDialog.locator('[aria-hidden="true"]').first();
    await expect(patternLayer).toBeAttached();
    const patternOpacity = await patternLayer.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).opacity);
    });
    expect(patternOpacity).toBeLessThanOrEqual(0.06);

    // Close details dialog (Escape or close button)
    await page.keyboard.press("Escape");
    await expect(detailsDialog).not.toBeVisible();

    // Now test Role Change Dialog
    const roleActionBtn = page.locator('button[data-testid^="user-actions-btn-"]').first();
    await roleActionBtn.click();

    const roleItem = page.locator('div[role="menuitem"][data-testid^="edit-role-"]').first();
    await roleItem.click();

    const roleDialog = page.locator('[data-testid="role-change-dialog"]');
    await expect(roleDialog).toBeVisible({ timeout: 10000 });

    const roleBox = await roleDialog.boundingBox();
    expect(roleBox).not.toBeNull();
    if (roleBox) {
      const roleCenterX = roleBox.x + roleBox.width / 2;
      const roleCenterY = roleBox.y + roleBox.height / 2;
      const viewportCenterX = 1440 / 2;
      const viewportCenterY = 900 / 2;

      expect(Math.abs(roleCenterX - viewportCenterX)).toBeLessThanOrEqual(10);
      expect(Math.abs(roleCenterY - viewportCenterY)).toBeLessThanOrEqual(10);
    }

    // Close role dialog
    await page.keyboard.press("Escape");
    await expect(roleDialog).not.toBeVisible();
  });
});
