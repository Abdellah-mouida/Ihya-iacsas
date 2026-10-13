import { test, expect, Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const TEST_PASSWORD = "StrongP@ssw0rd123";

async function loginAsUser(page: Page, email: string, pass: string = TEST_PASSWORD, callbackUrl = "/account") {
  await prisma.rateLimit.deleteMany({
    where: { key: `auth_login:${email.toLowerCase()}` },
  }).catch(() => {});
  await page.context().clearCookies();
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15000 });
  await page.fill('[data-testid="login-email-input"]', email);
  await page.fill('[data-testid="login-password-input"]', pass);
  await page.click('[data-testid="login-submit-btn"]');
  await expect(page).not.toHaveURL(/\/login(\?.*)?$/, { timeout: 20000 });
}

test.describe("Task 9: Booking Cutover Suite", () => {
  test.setTimeout(60000);
  const timestamp = Date.now();
  const testEmail = `booking.user.${timestamp}@ihyaa.org`;
  const incompleteEmail = `booking.incomplete.${timestamp}@ihyaa.org`;
  let userId = "";
  let openEventId = "";
  let openEventSlug = "";
  let limitedEventId = "";
  let limitedEventSlug = "";

  test.beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    // 1. Create a fully onboarded user
    const user = await prisma.user.create({
      data: {
        name: "يوسف الإدريسي",
        email: testEmail.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
        city: "الرباط",
        age: 26,
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: new Date(),
        sessionVersion: 1,
      },
    });
    userId = user.id;

    // 2. Create an incomplete onboarding user
    await prisma.user.create({
      data: {
        name: "مستخدم غير مكتمل",
        email: incompleteEmail.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: null,
        sessionVersion: 1,
      },
    });

    // 3. Create an OPEN event
    openEventSlug = `open-event-${timestamp}`;
    const openEvent = await prisma.event.create({
      data: {
        slug: openEventSlug,
        titleAr: "فعالية مفتوحة تجريبية",
        titleEn: "Open Test Event",
        descriptionAr: "وصف الفعالية المفتوحة",
        descriptionEn: "Open event description",
        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        time: "17:00",
        location: "الرباط",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "OPEN",
        bookingOpen: true,
      },
    });
    openEventId = openEvent.id;

    // 4. Create a LIMITED event with capacity 1
    limitedEventSlug = `limited-event-${timestamp}`;
    const limitedEvent = await prisma.event.create({
      data: {
        slug: limitedEventSlug,
        titleAr: "ورشة عمل محدودة المقاعد",
        titleEn: "Limited Workshop",
        descriptionAr: "وصف ورشة العمل",
        descriptionEn: "Workshop description",
        date: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        time: "19:00",
        location: "الدار البيضاء",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "LIMITED",
        capacity: 1,
        bookingOpen: true,
      },
    });
    limitedEventId = limitedEvent.id;
  });

  test.afterAll(async () => {
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { eventId: openEventId },
          { eventId: limitedEventId },
          { userId },
          { email: testEmail.toLowerCase() },
        ],
      },
    }).catch(() => {});

    await prisma.event.deleteMany({
      where: {
        id: { in: [openEventId, limitedEventId] },
      },
    }).catch(() => {});

    await prisma.user.deleteMany({
      where: {
        email: { in: [testEmail.toLowerCase(), incompleteEmail.toLowerCase()] },
      },
    }).catch(() => {});
  });

  test("1. Unauthenticated visitor visiting /book redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto("/book");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fbook/);
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible();
  });

  test("2. Unauthenticated visitor visiting /events/[slug]/book redirects to /login with callbackUrl", async ({ page }) => {
    await page.goto(`/events/${openEventSlug}/book`);
    await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=%2Fevents%2F${openEventSlug}%2Fbook`));
    await expect(page.locator('[data-testid="login-view"]')).toBeVisible();
  });

  test("3. Incomplete onboarding user visiting /events/[slug]/book redirects to /onboarding with callbackUrl", async ({ page }) => {
    const bookUrl = `/events/${openEventSlug}/book`;
    await loginAsUser(page, incompleteEmail, TEST_PASSWORD, bookUrl);

    // Should be redirected to /onboarding
    await expect(page).toHaveURL(new RegExp(`/onboarding\\?callbackUrl=%2Fevents%2F${openEventSlug}%2Fbook`));
    await expect(page.locator('[data-testid="onboarding-step-1"]')).toBeVisible({ timeout: 15000 });
  });

  test("4. Authenticated & onboarded user books OPEN event instantly without OTP", async ({ page }) => {
    const bookUrl = `/events/${openEventSlug}/book`;
    await loginAsUser(page, testEmail, TEST_PASSWORD, bookUrl);

    await expect(page).toHaveURL(`/events/${openEventSlug}/book`);
    await expect(page.locator('[data-testid="booking-stepper"]')).toBeVisible({ timeout: 20000 });

    // Verify Account Snapshot Card is pre-filled
    const snapshotCard = page.locator('[data-testid="account-snapshot-card"]');
    await expect(snapshotCard).toBeVisible();
    await expect(snapshotCard).toContainText("يوسف الإدريسي");
    await expect(snapshotCard).toContainText(testEmail);
    await expect(snapshotCard).toContainText("الرباط");
    await expect(snapshotCard).toContainText("26");

    // Optional Motive
    await page.fill('#b-motive', "متحمس لحضور هذا اللقاء المميز والمشاركة مع الشباب.");

    // Submit booking instantly (no OTP step!)
    const submitBtn = page
      .locator('[data-testid="submit-booking-btn"]')
      .or(page.getByRole("button", { name: /تأكيد الحجز|طلب حجز|انضمام|Confirm|Submit/i }));
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.click();

    // Verify confirmation screen reached
    await expect(page.locator('[data-testid="booking-confirmation-title"]')).toBeVisible({ timeout: 15000 });
    const statusBadge = page.locator('[data-testid="booking-status-badge"]');
    await expect(statusBadge).toContainText(/مؤكد|Confirmed/);

    // Verify action buttons
    await expect(page.locator('[data-testid="view-my-bookings-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="back-to-events-btn"]')).toBeVisible();

    // Verify database record
    const dbBooking = await prisma.booking.findFirst({
      where: {
        eventId: openEventId,
        userId,
      },
    });
    expect(dbBooking).not.toBeNull();
    expect(dbBooking?.fullName).toBe("يوسف الإدريسي");
    expect(dbBooking?.email).toBe(testEmail.toLowerCase());
    expect(dbBooking?.city).toBe("الرباط");
    expect(dbBooking?.age).toBe(26);
    expect(dbBooking?.status).toBe("CONFIRMED");
    expect(dbBooking?.motive).toBe("متحمس لحضور هذا اللقاء المميز والمشاركة مع الشباب.");
  });

  test("5. Already-booked user visiting the booking page is redirected to /events", async ({ page }) => {
    const bookUrl = `/events/${openEventSlug}/book`;
    await loginAsUser(page, testEmail, TEST_PASSWORD, bookUrl);

    // User is already booked for this event, should redirect back to events
    await expect(page).toHaveURL(new RegExp(`/events#event-${openEventId}|/events`));
  });

  test("6. Booked event appears in /account under 'My Bookings'", async ({ page }) => {
    await loginAsUser(page, testEmail, TEST_PASSWORD, "/account");

    const bookingsTab = page.locator('[data-testid="tab-bookings-btn"]');
    await expect(bookingsTab).toBeVisible({ timeout: 15000 });
    await bookingsTab.click();
    const bookingsList = page.locator('[data-testid="account-bookings-section"]');
    await expect(bookingsList).toBeVisible({ timeout: 15000 });
    await expect(bookingsList).toContainText("فعالية مفتوحة تجريبية");
    await expect(bookingsList).toContainText(/مؤكد|Confirmed/);
  });
});
