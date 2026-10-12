import { test, expect, Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const TEST_PASSWORD = "StrongP@ssw0rd123";
const TEST_NEW_PASSWORD = "NewStrongP@ssw0rd456";

async function loginAsUser(page: Page, email: string, pass: string = TEST_PASSWORD, callbackUrl = "/account") {
  await prisma.rateLimit.deleteMany({
    where: { key: `auth_login:${email.toLowerCase()}` },
  }).catch(() => {});
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });
  await page.fill('[data-testid="login-email-input"]', email);
  await page.fill('[data-testid="login-password-input"]', pass);
  await page.click('[data-testid="login-submit-btn"]');
  await expect(page).not.toHaveURL(/\/login(\?.*)?$/, { timeout: 20000 });
}

test.describe("Account Page (/account) Feature Suite", () => {
  test.setTimeout(45000);
  const timestamp = Date.now();
  const testEmail = `account.tester.${timestamp}@ihyaa.org`;
  const incompleteEmail = `incomplete.tester.${timestamp}@ihyaa.org`;
  let userId = "";
  let testEventId = "";

  test.beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    // 1. Create a fully onboarded user
    const user = await prisma.user.create({
      data: {
        name: "خالد التازي",
        email: testEmail.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
        city: "فاس",
        age: 25,
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: new Date(),
        sessionVersion: 1,
      },
    });
    userId = user.id;

    // 2. Create a user who hasn't completed onboarding
    await prisma.user.create({
      data: {
        name: "عمر غير مكتمل",
        email: incompleteEmail.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: null, // not completed
        sessionVersion: 1,
      },
    });

    // 3. Always create a dedicated future test event for bookings
    const event = await prisma.event.create({
      data: {
        slug: `account-test-event-${timestamp}`,
        titleAr: "مجلس إحياء التجريبي",
        titleEn: "Ihyaa Test Council",
        descriptionAr: "وصف الفعالية التجريبية",
        descriptionEn: "Test event description",
        date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days in the future
        time: "18:00",
        location: "الرباط",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "LIMITED",
        capacity: 50,
        bookingOpen: true,
      },
    });
    testEventId = event.id;

    // 4. Create a booking for the onboarded user
    await prisma.booking.create({
      data: {
        eventId: testEventId,
        userId: user.id,
        fullName: user.name || "خالد التازي",
        email: user.email!,
        city: user.city || "فاس",
        age: user.age || 25,
        confirmed: true,
        status: "CONFIRMED",
      },
    });
  });

  test.beforeEach(async () => {
    // Clear any rate limits for test emails between tests
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          contains: "tester",
        },
      },
    }).catch(() => {});
  });

  test.afterAll(async () => {
    // Cleanup bookings, rate limits, test users, and test event
    await prisma.booking.deleteMany({
      where: {
        OR: [{ email: testEmail }, { email: incompleteEmail }],
      },
    }).catch(() => {});
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          contains: "tester",
        },
      },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: testEmail }, { email: incompleteEmail }],
      },
    }).catch(() => {});
    if (testEventId) {
      await prisma.event.delete({ where: { id: testEventId } }).catch(() => {});
    }
  });

  test("1. Unauthenticated visit to /account redirects to /login", async ({ page }) => {
    await page.goto("/account");
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 10000 });
    expect(page.url()).toContain("/login");
    expect(decodeURIComponent(page.url())).toContain("callbackUrl=/account");
  });

  test("2. User with incomplete onboarding accessing /account redirects to /onboarding", async ({ page }) => {
    await loginAsUser(page, incompleteEmail, TEST_PASSWORD, "/account");
    await page.waitForURL((url) => url.pathname.includes("/onboarding"), { timeout: 10000 });
    expect(page.url()).toContain("/onboarding");
  });

  test("3. Fully onboarded user accesses /account and views Profile tab with details", async ({ page }) => {
    await loginAsUser(page, testEmail, TEST_PASSWORD, "/account");
    await expect(page.locator('[data-testid="account-page-title"]')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-testid="tab-profile-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-bookings-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-security-btn"]')).toBeVisible();

    // Verify profile fields pre-filled
    await expect(page.locator('[data-testid="account-name-input"]')).toHaveValue("خالد التازي");
    await expect(page.locator('[data-testid="account-email-input"]')).toHaveValue(testEmail);
    await expect(page.locator('[data-testid="account-email-verified-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-age-input"]')).toHaveValue("25");
  });

  test("4. User updates profile details (name, age) -> submits -> verified in DB", async ({ page }) => {
    await loginAsUser(page, testEmail, TEST_PASSWORD, "/account");
    await expect(page.locator('[data-testid="account-page-title"]')).toBeVisible({ timeout: 10000 });

    // Update name and age
    await page.fill('[data-testid="account-name-input"]', "خالد التازي المحدث");
    await page.fill('[data-testid="account-age-input"]', "26");

    await page.click('[data-testid="account-save-profile-btn"]');

    // Wait for toast or success
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });

    // Verify in database
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    expect(updatedUser?.name).toBe("خالد التازي المحدث");
    expect(updatedUser?.age).toBe(26);
  });

  test("5. User switches to Security tab and updates password", async ({ page }) => {
    await loginAsUser(page, testEmail, TEST_PASSWORD, "/account");
    await expect(page.locator('[data-testid="account-page-title"]')).toBeVisible({ timeout: 10000 });

    // Switch to Security tab
    await page.click('[data-testid="tab-security-btn"]');
    await expect(page.locator('[data-testid="account-security-section"]')).toBeVisible();

    // Fill password form
    await page.fill('[data-testid="account-current-password-input"]', TEST_PASSWORD);
    await page.fill('[data-testid="account-new-password-input"]', TEST_NEW_PASSWORD);
    await page.fill('[data-testid="account-confirm-password-input"]', TEST_NEW_PASSWORD);

    await page.click('[data-testid="account-update-password-btn"]');

    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10000 });

    // Verify in database: password hash changed and sessionVersion incremented
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    const match = await bcrypt.compare(TEST_NEW_PASSWORD, updatedUser!.passwordHash!);
    expect(match).toBe(true);
    expect(updatedUser?.sessionVersion).toBe(2);
  });

  test("6. User switches to Bookings tab, views booking badge, and cancels booking via confirm dialog", async ({ page }) => {
    // Note: User now has TEST_NEW_PASSWORD from test 5
    await loginAsUser(page, testEmail, TEST_NEW_PASSWORD, "/account");
    await expect(page.locator('[data-testid="account-page-title"]')).toBeVisible({ timeout: 10000 });

    // Switch to Bookings tab
    await page.click('[data-testid="tab-bookings-btn"]');
    await expect(page.locator('[data-testid="account-bookings-section"]')).toBeVisible();

    // Verify booking card is visible
    const booking = await prisma.booking.findFirst({
      where: { userId },
    });
    expect(booking).toBeTruthy();

    const bookingCard = page.locator(`[data-testid="booking-card-${booking!.id}"]`);
    await expect(bookingCard).toBeVisible();

    // Verify status badge
    await expect(page.locator(`[data-testid="booking-status-${booking!.id}"]`)).toBeVisible();

    // Click Cancel Booking button
    const cancelBtn = page.locator(`[data-testid="cancel-booking-btn-${booking!.id}"]`);
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // In-app confirm dialog should appear
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    await expect(confirmDialog).toBeVisible();

    // Click confirm in dialog
    await page.click('[data-testid="confirm-dialog-confirm"]');

    // Dialog closes and booking card disappears
    await expect(bookingCard).not.toBeVisible({ timeout: 10000 });

    // Verify booking is deleted from database
    const deletedBooking = await prisma.booking.findUnique({
      where: { id: booking!.id },
    });
    expect(deletedBooking).toBeNull();

    // Empty state should now appear
    await expect(page.locator('[data-testid="no-bookings-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="browse-events-btn"]')).toBeVisible();
  });

  test("7. User clicks Sign Out from account page -> session terminated and redirected to /login", async ({ page }) => {
    await loginAsUser(page, testEmail, TEST_NEW_PASSWORD, "/account");
    await expect(page.locator('[data-testid="account-page-title"]')).toBeVisible({ timeout: 10000 });

    await page.click('[data-testid="tab-security-btn"]');
    await expect(page.locator('[data-testid="account-security-section"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="account-signout-btn"]')).toBeVisible({ timeout: 10000 });

    await page.click('[data-testid="account-signout-btn"]');
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 15000 });
    expect(page.url()).toContain("/login");
  });
});
