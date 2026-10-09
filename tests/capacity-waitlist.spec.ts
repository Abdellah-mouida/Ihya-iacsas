import { test, expect, type Page } from "@playwright/test";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ihyaa-admin-dev-pass-2026";
const OTP_SECRET = process.env.OTP_SECRET || "ihyaa-secure-production-salt-2026";

function computeHash(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
    .digest("hex");
}

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
  await expect(page.locator("aside")).toBeVisible({ timeout: 15000 });
}

test.describe.serial("Event Capacity System & Waitlist Flow", () => {
  test.setTimeout(120_000);

  const user1Email = "user1.capacity.test@gmail.com";
  const user2Email = "user2.capacity.test@gmail.com";
  const user3Email = "user3.capacity.test@gmail.com";

  let eventId: string;
  let booking1Id: string;
  let booking2Id: string;
  let booking3Id: string;

  async function cleanupTestData() {
    await prisma.booking.deleteMany({
      where: {
        email: { in: [user1Email, user2Email, user3Email] },
      },
    });
    await prisma.otpVerification.deleteMany({
      where: {
        email: { in: [user1Email, user2Email, user3Email] },
      },
    });
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          in: [
            `otp_gen_cooldown:${user1Email}`,
            `otp_gen_window:${user1Email}`,
            `otp_ver_rate:${user1Email}`,
            `otp_gen_cooldown:${user2Email}`,
            `otp_gen_window:${user2Email}`,
            `otp_ver_rate:${user2Email}`,
            `otp_gen_cooldown:${user3Email}`,
            `otp_gen_window:${user3Email}`,
            `otp_ver_rate:${user3Email}`,
          ],
        },
      },
    });
  }

  test.beforeAll(async () => {
    await cleanupTestData();

    // Clean up prior event if exists
    const priorEvent = await prisma.event.findFirst({
      where: { titleAr: "ورشة القيادة والأثر" },
    });
    if (priorEvent) {
      await prisma.booking.deleteMany({
        where: { eventId: priorEvent.id },
      });
      await prisma.event.delete({
        where: { id: priorEvent.id },
      });
    }

    // Create limited event with capacity 2
    const createdEvent = await prisma.event.create({
      data: {
        slug: `leadership-impact-workshop-${Date.now()}`,
        titleAr: "ورشة القيادة والأثر",
        titleEn: "Leadership & Impact Workshop",
        descriptionAr: "ورشة عمل تدريبية ذات مقاعد محدودة لاختبار نظام السعة وقائمة الانتظار",
        descriptionEn: "Workshop with limited capacity to test waitlist flow",
        date: new Date("2026-11-20T18:00:00Z"),
        time: "18:00",
        location: "الرباط",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "LIMITED",
        capacity: 2,
        bookingOpen: true,
      },
    });
    eventId = createdEvent.id;
  });

  test.afterAll(async () => {
    await cleanupTestData();
    if (eventId) {
      await prisma.booking.deleteMany({ where: { eventId } });
      await prisma.event.deleteMany({ where: { id: eventId } });
    }
  });

  async function completeBookingForm(
    page: Page,
    targetEventId: string,
    fullName: string,
    email: string,
    cityOptionTestId: string
  ) {
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/events/${targetEventId}/book`);

    await page.fill("#b-name", fullName);
    await page.fill("#b-email", email);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click(`[data-testid="${cityOptionTestId}"]`);

    await page.fill("#b-age", "26");
    await page.fill("#b-motive", "المشاركة في فعاليات برنامج إحياء التدريبية والتطويرية");

    await page.click('button[type="submit"]');

    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 50000 });

    const activeOtp = await prisma.otpVerification.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(activeOtp).toBeTruthy();

    const testOtp = "987654";
    const testHash = computeHash(testOtp, email);

    await prisma.otpVerification.update({
      where: { id: activeOtp!.id },
      data: {
        otpHash: testHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    for (let i = 0; i < testOtp.length; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, testOtp[i]);
    }
    await expect(page.locator('[data-testid="booking-confirmation-title"]')).toBeVisible({ timeout: 45000 });
  }

  test("1. User 1 books limited event -> receives PENDING status", async ({ page }) => {
    await completeBookingForm(
      page,
      eventId,
      "المستخدم الأول",
      user1Email,
      "city-option-rabat"
    );

    // Verify confirmation step displays pending review notice
    await expect(page.locator("body")).toContainText(/طلبك قيد المراجعة|مراجعة/i, {
      timeout: 30000,
    });

    const b1 = await prisma.booking.findFirst({
      where: { email: user1Email, eventId },
    });
    expect(b1).toBeTruthy();
    expect(b1?.status).toBe("PENDING");
    booking1Id = b1!.id;
  });

  test("2. User 2 books limited event -> receives PENDING status", async ({ page }) => {
    await completeBookingForm(
      page,
      eventId,
      "المستخدم الثاني",
      user2Email,
      "city-option-casablanca"
    );

    await expect(page.locator("body")).toContainText(/طلبك قيد المراجعة|مراجعة/i, {
      timeout: 30000,
    });

    const b2 = await prisma.booking.findFirst({
      where: { email: user2Email, eventId },
    });
    expect(b2).toBeTruthy();
    expect(b2?.status).toBe("PENDING");
    booking2Id = b2!.id;
  });

  test("3. Admin approves User 1 -> status becomes CONFIRMED (1/2 capacity)", async ({
    page,
  }) => {
    await loginAdmin(page);

    await page.goto("/admin/bookings");
    const approveBtn = page.locator(`[data-testid="approve-btn-${booking1Id}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 15000 });
    await approveBtn.click();

    // Verify status badge on bookings page updates to confirmed
    const statusBadge = page.locator(`[data-testid="booking-status-${booking1Id}"]`);
    await expect(statusBadge).toContainText(/مؤكد|Confirmed/i, { timeout: 10000 });

    const b1 = await prisma.booking.findUnique({ where: { id: booking1Id } });
    expect(b1?.status).toBe("CONFIRMED");

    // Verify admin events page reflects 1/2 confirmed and 1 pending
    await page.goto("/admin/events");
    const capacityDisplay = page.locator(`[data-testid="event-capacity-${eventId}"]`);
    await expect(capacityDisplay).toContainText("1/2");
    await expect(capacityDisplay).toContainText(/قيد المراجعة|pending/i);
  });

  test("4. Admin approves User 2 -> status becomes CONFIRMED (2/2 capacity - full)", async ({
    page,
  }) => {
    await loginAdmin(page);

    await page.goto("/admin/bookings");
    const approveBtn = page.locator(`[data-testid="approve-btn-${booking2Id}"]`);
    await expect(approveBtn).toBeVisible({ timeout: 15000 });
    await approveBtn.click();

    const statusBadge = page.locator(`[data-testid="booking-status-${booking2Id}"]`);
    await expect(statusBadge).toContainText(/مؤكد|Confirmed/i, { timeout: 10000 });

    const b2 = await prisma.booking.findUnique({ where: { id: booking2Id } });
    expect(b2?.status).toBe("CONFIRMED");

    // Verify admin events page reflects 2/2 confirmed
    await page.goto("/admin/events");
    const capacityDisplay = page.locator(`[data-testid="event-capacity-${eventId}"]`);
    await expect(capacityDisplay).toContainText("2/2");
  });

  test("5. User 3 books full event -> joins WAITLIST with position #1", async ({ page }) => {
    // Check booking page reflects capacity full status
    await page.goto(`/events/${eventId}/book`);
    await expect(page.locator("body")).toContainText(/قائمة الانتظار|waitlist/i);

    await completeBookingForm(
      page,
      eventId,
      "المستخدم الثالث",
      user3Email,
      "city-option-tangier"
    );

    // Verify confirmation step displays waitlist confirmation
    await expect(page.locator("body")).toContainText(/قائمة الانتظار/i, { timeout: 30000 });
    await expect(page.locator("body")).toContainText("#1");

    const b3 = await prisma.booking.findFirst({
      where: { email: user3Email, eventId },
    });
    expect(b3).toBeTruthy();
    expect(b3?.status).toBe("WAITLISTED");
    expect(b3?.waitlistOrder).toBe(1);
    booking3Id = b3!.id;
  });

  test("6. Admin sees User 3 waitlisted and waitlist count on events page", async ({
    page,
  }) => {
    await loginAdmin(page);

    await page.goto("/admin/bookings");
    const waitlistBadge = page.locator(`[data-testid="booking-status-${booking3Id}"]`);
    await expect(waitlistBadge).toBeVisible();
    await expect(waitlistBadge).toContainText(/قائمة الانتظار/i);
    await expect(waitlistBadge).toContainText("#1");

    await page.goto("/admin/events");
    const capacityDisplay = page.locator(`[data-testid="event-capacity-${eventId}"]`);
    await expect(capacityDisplay).toContainText("2/2");
    await expect(capacityDisplay).toContainText(/انتظار|waitlist/i);
  });

  test("7. Admin rejects User 1 -> spot opens -> User 3 is auto-promoted to CONFIRMED", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await loginAdmin(page);

    await page.goto("/admin/bookings");
    const rejectBtn = page.locator(`[data-testid="reject-btn-${booking1Id}"]`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });
    await rejectBtn.click();

    // Confirm in custom in-app confirm dialog if present
    const confirmBtn = page.locator('[data-testid="confirm-dialog-confirm"]');
    if (await confirmBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await confirmBtn.click();
    }

    // Verify User 1 becomes REJECTED
    const user1Status = page.locator(`[data-testid="booking-status-${booking1Id}"]`);
    await expect(user1Status).toContainText(/مرفوض|Rejected/i, { timeout: 25000 });

    // Verify User 3 is promoted to CONFIRMED
    const user3Status = page.locator(`[data-testid="booking-status-${booking3Id}"]`);
    await expect(user3Status).toContainText(/مؤكد|Confirmed/i, { timeout: 25000 });

    // Check DB state
    const b1 = await prisma.booking.findUnique({ where: { id: booking1Id } });
    expect(b1?.status).toBe("REJECTED");

    const b3 = await prisma.booking.findUnique({ where: { id: booking3Id } });
    expect(b3?.status).toBe("CONFIRMED");
    expect(b3?.waitlistOrder).toBeNull();

    // Verify events page still shows 2/2 confirmed (User 2 & promoted User 3) and 0 waitlist
    await page.goto("/admin/events");
    const capacityDisplay = page.locator(`[data-testid="event-capacity-${eventId}"]`);
    await expect(capacityDisplay).toContainText("2/2");
  });
});
