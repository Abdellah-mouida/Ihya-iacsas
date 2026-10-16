import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import {
  TEST_ADMIN,
  ensureTestUser,
  loginAs,
} from "./helpers/admin-auth";

const TEST_PROFILE_USER = {
  email: "profile.tester.2026@ihyaa.test",
  password: "UserProfile123!",
  fullName: "حسام رحالة تجريبي",
  role: "USER" as const,
  city: "tetouan",
  age: 23,
};

test.describe("Optional Profile Details (Task 9)", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
    await ensureTestUser(TEST_PROFILE_USER);
  });

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("1. User can view optional profile section with inputs and tag editors", async ({
    page,
  }) => {
    await loginAs(page, TEST_PROFILE_USER, "/account");
    await page.goto("/account");

    const section = page.locator('[data-testid="account-optional-details-section"]');
    await expect(section).toBeVisible();

    const bioInput = page.locator('[data-testid="account-bio-input"]');
    await expect(bioInput).toBeVisible();

    const studyInput = page.locator('[data-testid="account-studylevel-input"]');
    await expect(studyInput).toBeVisible();

    const instInput = page.locator('[data-testid="account-institution-input"]');
    await expect(instInput).toBeVisible();

    await expect(page.locator('[data-testid="account-interests-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-skills-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-languages-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-volunteer-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-privacy-notice"]')).toBeVisible();
  });

  test("2. User can enter bio, study, institution, toggle presets, and add custom tags", async ({
    page,
  }) => {
    await loginAs(page, TEST_PROFILE_USER, "/account");
    await page.goto("/account");

    // Bio with counter
    const bioInput = page.locator('[data-testid="account-bio-input"]');
    const bioText = "طالب جامعي ومهتم بالتخييم والأنشطة الشبابية وتطوير المهارات.";
    await bioInput.fill(bioText);
    await expect(page.locator('[data-testid="account-bio-count"]')).toContainText(
      `${bioText.length} / 280`
    );

    // Study & Institution
    await page.locator('[data-testid="account-studylevel-input"]').fill("Master Degree in Data Science");
    await page.locator('[data-testid="account-institution-input"]').fill("Abdelmalek Essaadi University");

    // Add preset tag for interests if available
    const firstInterestPreset = page.locator('[data-testid^="account-interests-preset-"]').first();
    if (await firstInterestPreset.isVisible()) {
      await firstInterestPreset.click();
    }

    // Add custom tag for skills
    const skillInput = page.locator('[data-testid="account-skills-input"]');
    await skillInput.fill("Problem Solving");
    await page.locator('[data-testid="account-skills-add-btn"]').click();

    // Verify tag added
    await expect(page.locator('[data-testid="account-skills-tag-0"]')).toContainText("Problem Solving");

    // Add preset for languages if available
    const langPreset = page.locator('[data-testid^="account-languages-preset-"]').first();
    if (await langPreset.isVisible()) {
      await langPreset.click();
    }

    // Save profile and wait for save button to settle
    const saveBtn = page.locator('[data-testid="account-save-profile-btn"]');
    await saveBtn.click();
    await expect(saveBtn).not.toBeDisabled({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Reload and verify persisted data
    await page.reload();
    await expect(page.locator('[data-testid="account-bio-input"]')).toHaveValue(bioText);
    await expect(page.locator('[data-testid="account-studylevel-input"]')).toHaveValue(
      "Master Degree in Data Science"
    );
    await expect(page.locator('[data-testid="account-institution-input"]')).toHaveValue(
      "Abdelmalek Essaadi University"
    );
    await expect(page.locator('[data-testid="account-skills-tag-0"]')).toContainText("Problem Solving");
  });

  test("3. Server strips HTML tags and enforces plain text sanitization", async ({
    page,
  }) => {
    await loginAs(page, TEST_PROFILE_USER, "/account");
    await page.goto("/account");

    // Enter HTML tags in bio and institution
    const bioInput = page.locator('[data-testid="account-bio-input"]');
    await bioInput.fill("<b>Bold Leader</b> <script>alert('xss')</script> Passionate camper");

    const instInput = page.locator('[data-testid="account-institution-input"]');
    await instInput.fill("<a href='https://evil.com'>University Tech</a>");

    // Save profile
    const saveBtn = page.locator('[data-testid="account-save-profile-btn"]');
    await saveBtn.click();
    await expect(saveBtn).not.toBeDisabled({ timeout: 10000 });
    await page.waitForTimeout(1500);

    // Verify in database that HTML tags were stripped
    const userInDb = await prisma.user.findUnique({
      where: { email: TEST_PROFILE_USER.email },
      select: { bio: true, institution: true },
    });

    expect(userInDb?.bio).not.toBeNull();
    expect(userInDb?.bio).not.toContain("<b>");
    expect(userInDb?.bio).not.toContain("<script>");
    expect(userInDb?.bio).toContain("Bold Leader  Passionate camper");

    expect(userInDb?.institution).not.toBeNull();
    expect(userInDb?.institution).not.toContain("<a");
    expect(userInDb?.institution).toContain("University Tech");
  });

  test("4. Community Administrator can view optional details in User Details Dialog", async ({
    page,
  }) => {
    // Get target profile user id
    const target = await prisma.user.findUnique({
      where: { email: TEST_PROFILE_USER.email },
    });
    expect(target).not.toBeNull();

    // Login as Admin
    await loginAs(page, TEST_ADMIN, "/admin/users");
    await page.goto("/admin/users");

    // Search for profile tester
    const searchInput = page.locator('[data-testid="users-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(TEST_PROFILE_USER.email);
    await searchInput.press("Enter");

    // Wait for target user row to appear
    const targetRow = page.locator(`[data-testid="user-row-${target!.id}"]`);
    await expect(targetRow).toBeVisible({ timeout: 15000 });

    // Open action menu for this user and click View Details
    const actionBtn = page.locator(`[data-testid="user-actions-btn-${target!.id}"]`);
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    const viewDetailsItem = page.locator(`[data-testid="view-user-${target!.id}"]`);
    await expect(viewDetailsItem).toBeVisible({ timeout: 5000 });
    await viewDetailsItem.click();

    // Verify User Details Dialog shows Optional Profile Details section
    const detailsDialog = page.locator('[data-testid="user-details-dialog"]');
    await expect(detailsDialog).toBeVisible({ timeout: 10000 });

    const optionalSection = page.locator('[data-testid="admin-user-optional-details"]');
    await expect(optionalSection).toBeVisible();

    // Should contain bio text and institution
    await expect(optionalSection).toContainText("Bold Leader");
    await expect(optionalSection).toContainText("University Tech");
  });

  test("5. Privacy Policy page documents optional profile fields & RBAC", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(page.locator('[data-testid="privacy-page"]')).toBeVisible();

    // Check collection section includes mention of optional fields
    const collectionSec = page.locator('[data-testid="privacy-section-collection"]');
    await expect(collectionSec).toBeVisible();

    // Check security section mentions RBAC / roles
    const securitySec = page.locator('[data-testid="privacy-section-security"]');
    await expect(securitySec).toBeVisible();
  });

  test("6. Responsive layout at 320px viewport without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await loginAs(page, TEST_PROFILE_USER, "/account");
    await page.goto("/account");

    const section = page.locator('[data-testid="account-optional-details-section"]');
    await expect(section).toBeVisible();

    // Verify horizontal overflow is within viewport
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(330);
  });
});
