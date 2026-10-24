import { test, expect } from "@playwright/test";
import { loginAdmin } from "./helpers/admin-auth";

test.describe("Task 3: Admin Themes Management", () => {
  test("shows only the 4 default themes and no 'Add Custom Theme' button", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/themes");
    await page.waitForLoadState("networkidle");

    // Verify "Add Custom Theme" button does NOT exist
    const addBtn = page.locator('[data-testid="admin-add-theme-btn"]');
    await expect(addBtn).toHaveCount(0);

    // Verify the 4 built-in theme cards are present
    const lightCard = page.locator('[data-testid="admin-theme-card-light"]');
    const sunsetCard = page.locator('[data-testid="admin-theme-card-sunset"]');
    const amoledCard = page.locator('[data-testid="admin-theme-card-amoled"]');
    const blackCard = page.locator('[data-testid="admin-theme-card-black"]');

    await expect(lightCard).toBeVisible();
    await expect(sunsetCard).toBeVisible();
    await expect(amoledCard).toBeVisible();
    await expect(blackCard).toBeVisible();

    // Verify total theme cards count is exactly 4
    const cards = page.locator('[data-testid^="admin-theme-card-"]');
    await expect(cards).toHaveCount(4);
  });

  test("can edit a default theme and shows Reset to default button", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/themes");
    await page.waitForLoadState("networkidle");

    // Click edit on Sunset theme
    const sunsetCard = page.locator('[data-testid="admin-theme-card-sunset"]');
    await sunsetCard.getByRole("button", { name: /تعديل|Edit/i }).click();

    // Verify editor opens
    const editorHeading = page.getByRole("heading", { name: /تعديل سمة|Edit Theme/i });
    await expect(editorHeading).toBeVisible();

    // Verify slug field is disabled
    const slugInput = page.locator('input[disabled]');
    await expect(slugInput).toHaveValue("sunset");

    // Verify "Reset to default" button is available
    const resetBtn = page.getByRole("button", { name: /استعادة الافتراضي|Reset to Default/i });
    await expect(resetBtn).toBeVisible();
  });
});
