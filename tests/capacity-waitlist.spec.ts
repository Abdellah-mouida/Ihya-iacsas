import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { loginAdmin, assertDevBranchDatabase } from "./helpers/admin-auth";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

test.describe.serial("Event Capacity System & Waitlist Flow", () => {
  test.setTimeout(120_000);

  let testUsers: Array<{ id: string; email: string; password: string }> = [];

  let eventId: string;
  let booking1Id: string;
  let booking2Id: string;
  let booking3Id: string;

  async function cleanupTestData() {
    assertDevBranchDatabase("Capacity Test Cleanup");
    if (testUsers.length) {
      const bookings = await prisma.booking.findMany({
        where: { userId: { in: testUsers.map((user) => user.id) } },
        select: { id: true },
      });
      await prisma.auditLog.deleteMany({ where: { targetId: { in: bookings.map((booking) => booking.id) } } });
      await prisma.booking.deleteMany({ where: { userId: { in: testUsers.map((user) => user.id) } } });
      await prisma.session.deleteMany({ where: { userId: { in: testUsers.map((user) => user.id) } } });
    }
  }

  test.beforeAll(async () => {
    await cleanupTestData();
    testUsers = await Promise.all([
      createSyntheticUser("Capacity waitlist user 1"),
      createSyntheticUser("Capacity waitlist user 2"),
      createSyntheticUser("Capacity waitlist user 3"),
    ]);
    await prisma.user.updateMany({
      where: { id: { in: testUsers.map((user) => user.id) } },
      data: {
        city: "Rabat",
        age: 26,
        onboardingCompletedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
      },
    });

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
    for (const user of testUsers) await removeSyntheticUser(user.id);
    testUsers = [];
  });

  async function completeBookingForm(
    page: Page,
    targetEventId: string,
    email: string,
    expectWaitlist: boolean = false,
  ) {
    const user = testUsers.find((candidate) => candidate.email === email);
    if (!user) throw new Error(`No synthetic capacity account matches ${email}`);
    await page.goto(`/login?callbackUrl=${encodeURIComponent(`/events/${targetEventId}/book`)}`);
    await page.locator('[data-testid="login-email-input"]').fill(user.email);
    await page.locator('[data-testid="login-password-input"]').fill(user.password);
    await page.locator('[data-testid="login-submit-btn"]').click();
    await expect(page).toHaveURL(new RegExp(`/events/${targetEventId}/book`), { timeout: 30_000 });
    await expect(page.locator('[data-testid="booking-stepper"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid="account-snapshot-card"]')).toBeVisible({ timeout: 30_000 });
    if (expectWaitlist) await expect(page.locator("body")).toContainText(/قائمة الانتظار|waitlist/i);
    await page.fill("#b-motive", "المشاركة في فعاليات برنامج إحياء التدريبية والتطويرية");
    await page.locator('[data-testid="submit-booking-btn"]').click();
    await expect(page.locator('[data-testid="booking-confirmation-title"]')).toBeVisible({ timeout: 45000 });
  }

  test("1. User 1 books limited event -> receives PENDING status", async ({ page }) => {
    await completeBookingForm(page, eventId, testUsers[0].email);

    // Verify confirmation step displays pending review notice
    await expect(page.locator("body")).toContainText(/طلبك قيد المراجعة|مراجعة/i, {
      timeout: 30000,
    });

    const b1 = await prisma.booking.findFirst({ where: { userId: testUsers[0].id, eventId } });
    expect(b1).toBeTruthy();
    expect(b1?.status).toBe("PENDING");
    booking1Id = b1!.id;
  });

  test("2. User 2 books limited event -> receives PENDING status", async ({ page }) => {
    await completeBookingForm(page, eventId, testUsers[1].email);

    await expect(page.locator("body")).toContainText(/طلبك قيد المراجعة|مراجعة/i, {
      timeout: 30000,
    });

    const b2 = await prisma.booking.findFirst({ where: { userId: testUsers[1].id, eventId } });
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
    await expect.poll(async () => {
      return (await prisma.booking.findUnique({ where: { id: booking1Id }, select: { status: true } }))?.status;
    }, { timeout: 30_000 }).toBe("CONFIRMED");
    await page.reload();

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
    await expect.poll(async () => {
      return (await prisma.booking.findUnique({ where: { id: booking2Id }, select: { status: true } }))?.status;
    }, { timeout: 30_000 }).toBe("CONFIRMED");
    await page.reload();

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
    await completeBookingForm(page, eventId, testUsers[2].email, true);

    // Verify confirmation step displays waitlist confirmation
    await expect(page.locator("body")).toContainText(/قائمة الانتظار/i, { timeout: 30000 });
    await expect(page.locator("body")).toContainText("#1");

    const b3 = await prisma.booking.findFirst({
      where: { userId: testUsers[2].id, eventId },
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
