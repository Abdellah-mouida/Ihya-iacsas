import { test, expect } from "@playwright/test";
import { ensureTestUser, loginAs, TEST_ADMIN } from "./helpers/admin-auth";

test.describe("Task 4 & 6: Admin themes deprecation", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
  });

  test("GET /admin/themes returns 404 for authenticated admin and admin navigation excludes Themes link", async ({ page }) => {
    await loginAs(page, TEST_ADMIN, "/admin");
    await expect(page).toHaveURL(/\/admin/);

    const adminLink = page.locator('nav a[href="/admin/themes"]');
    await expect(adminLink).toHaveCount(0);

    const res = await page.goto("/admin/themes");
    expect(res?.status()).toBe(404);
  });
});

