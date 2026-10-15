import { test, expect, Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const ADMIN_PASS = process.env.ADMIN_PASSWORD || "ihyaa-admin-dev-pass-2026";

async function loginAdmin(page: Page) {
  await prisma.rateLimit.deleteMany({
    where: { key: { contains: "admin_login" } },
  });
  await page.goto("/admin/login");
  const pwdInput = page.locator('input[type="password"]');
  await expect(pwdInput).toBeVisible({ timeout: 15000 });
  await pwdInput.fill(ADMIN_PASS);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
}

test.describe("Task 3: Reusable Image Cropper Dialog for Every Upload", () => {
  const testEmail = `cropper.user.${Date.now()}@ihyaa.org`;
  const testPassword = "Password123!";
  let testUserId: string;

  test.beforeAll(async () => {
    // Generate a temporary test image if not exists
    const testImgPath = path.join(process.cwd(), "tests", "fixtures", "test-crop-avatar.png");
    const fixturesDir = path.dirname(testImgPath);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    // 100x100 PNG
    const pngBuffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(testImgPath, pngBuffer);

    // Create user needing onboarding
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "زائر للتجربة",
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
      },
    });
    testUserId = user.id;
  });

  test.afterAll(async () => {
    try {
      if (testUserId) {
        await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
      }
    } catch {
      // ignore
    }
  });

  test("1. Onboarding avatar file selection opens ImageCropperDialog with round crop", async ({ page }) => {
    // 1. Log in
    await prisma.rateLimit.deleteMany({
      where: { key: { contains: testEmail } },
    });
    await page.goto("/login?callbackUrl=/onboarding");
    await page.fill('[data-testid="login-email-input"]', testEmail);
    await page.fill('[data-testid="login-password-input"]', testPassword);
    await page.click('[data-testid="login-submit-btn"]');

    // Should redirect to onboarding
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible({ timeout: 15000 });

    // Step 1: fill city and age
    await page.click('[data-testid="city-combobox-trigger"]');
    await expect(page.locator('[data-testid="city-search-input"]')).toBeVisible();
    await page.fill('[data-testid="city-search-input"]', "تطوان");
    await page.click('[data-testid="city-option-tetouan"]');

    await page.fill('[data-testid="onboarding-age-input"]', "24");
    await page.click('[data-testid="onboarding-next-btn"]');

    // Step 2: Avatar upload step
    await expect(page.locator('[data-testid="onboarding-step-2"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="onboarding-photo-input"]')).toBeAttached();

    // Set file input
    const testImgPath = path.join(process.cwd(), "tests", "fixtures", "test-crop-avatar.png");
    await page.setInputFiles('[data-testid="onboarding-photo-input"]', testImgPath);

    // The cropper modal should appear
    const cropperModal = page.locator('[data-testid="image-cropper-dialog"]');
    await expect(cropperModal).toBeVisible({ timeout: 10000 });

    // Check cropper controls
    await expect(page.locator('[data-testid="cropper-zoom-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="cropper-rotate-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="cropper-confirm-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="cropper-cancel-btn"]')).toBeVisible();

    // Rotate image once
    await page.click('[data-testid="cropper-rotate-btn"]');

    // Confirm crop
    await page.click('[data-testid="cropper-confirm-btn"]');

    // Cropper should close and preview should appear
    await expect(cropperModal).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="avatar-preview-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="remove-photo-btn"]')).toBeVisible();
  });

  test("2. Admin events modal file selection opens ImageCropperDialog with aspect ratio presets", async ({ page }) => {
    await loginAdmin(page);

    // Navigate to events
    await page.goto("/admin/events");
    const addBtn = page.locator('[data-testid="create-event-btn"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    await expect(page.locator('[data-testid="event-modal"]')).toBeVisible();

    // Attach file to poster input
    const testImgPath = path.join(process.cwd(), "tests", "fixtures", "test-crop-avatar.png");
    await page.setInputFiles('[data-testid="event-image-file-input"]', testImgPath);

    // Image cropper modal should open
    const cropperModal = page.locator('[data-testid="image-cropper-dialog"]');
    await expect(cropperModal).toBeVisible({ timeout: 10000 });

    // Presets should be visible (4:5, 1:1, 16:9, Free)
    await expect(page.locator('[data-testid="cropper-preset-4-5"]')).toBeVisible();
    await expect(page.locator('[data-testid="cropper-preset-1-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="cropper-preset-16-9"]')).toBeVisible();

    // Click 1:1 preset
    await page.click('[data-testid="cropper-preset-1-1"]');

    // Confirm crop
    await page.click('[data-testid="cropper-confirm-btn"]');

    // Cropper should close and poster preview in form should be visible
    await expect(cropperModal).not.toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="poster-preview-img"]')).toBeVisible();
  });
});
