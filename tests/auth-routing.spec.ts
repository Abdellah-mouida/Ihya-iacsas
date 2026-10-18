import { test, expect } from "@playwright/test";

test.describe("Auth Routing & OAuth Cancellation / Error Handling", () => {
  test("1. Unauthenticated visit to /admin redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible({ timeout: 15000 });
  });

  test("2. Unauthenticated visit to /settings redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fsettings/);
  });

  test("3. Unauthenticated visit to /profile redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fprofile/);
  });

  test("4. OAuth cancellation (error=access_denied) on /login shows cancelled feedback and keeps submit enabled", async ({ page }) => {
    await page.goto("/login?error=access_denied");
    await page.waitForLoadState("domcontentloaded");

    // Check toast or inline error message
    const alertOrToast = page.locator("text=تم إلغاء تسجيل الدخول باستخدام Google").or(page.locator("text=Sign in with Google was cancelled"));
    await expect(alertOrToast.first()).toBeVisible({ timeout: 10000 });

    // Google button should not be permanently stuck in loading/disabled
    const googleBtn = page.locator('[data-testid="google-signin-btn"]');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).not.toBeDisabled();
  });

  test("5. OAuth generic error on /login shows error feedback and keeps submit enabled", async ({ page }) => {
    await page.goto("/login?error=OAuthCallbackError");
    await page.waitForLoadState("domcontentloaded");

    const errorFeedback = page.locator("text=فشل تسجيل الدخول عبر Google").or(page.locator("text=Failed to sign in with Google"));
    await expect(errorFeedback.first()).toBeVisible({ timeout: 10000 });

    const googleBtn = page.locator('[data-testid="google-signin-btn"]');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).not.toBeDisabled();
  });

  test("6. OAuth cancellation (error=access_denied) on /signup shows cancelled feedback", async ({ page }) => {
    await page.goto("/signup?error=access_denied");
    await page.waitForLoadState("domcontentloaded");

    const alertOrToast = page.locator("text=تم إلغاء تسجيل الدخول باستخدام Google").or(page.locator("text=Sign in with Google was cancelled"));
    await expect(alertOrToast.first()).toBeVisible({ timeout: 10000 });

    const googleBtn = page.locator('[data-testid="signup-google"]');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).not.toBeDisabled();
  });
});
