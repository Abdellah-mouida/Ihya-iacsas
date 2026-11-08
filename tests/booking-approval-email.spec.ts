import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

import { prisma } from "../src/lib/prisma";
import { loginAdmin } from "./helpers/admin-auth";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

test("approval persists when mail is unavailable and emits one approval audit", async ({ page }) => {
  test.setTimeout(120_000);
  assertDevBranchDatabase("Booking approval email test");
  const user = await createSyntheticUser("Booking approval email test user");
  const suffix = randomBytes(8).toString("hex");
  let eventId: string | undefined;
  let bookingId: string | undefined;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        city: "Rabat",
        age: 25,
        locale: "en",
        onboardingCompletedAt: new Date(),
      },
    });
    const event = await prisma.event.create({
      data: {
        slug: `approval-email-${suffix}`,
        titleAr: `اختبار موافقة ${suffix}`,
        titleEn: `Approval email ${suffix}`,
        descriptionAr: "اختبار موافقة الحجز",
        descriptionEn: "Booking approval test",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        time: "18:00",
        location: "Rabat",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "OPEN",
        bookingOpen: true,
      },
    });
    eventId = event.id;
    const booking = await prisma.booking.create({
      data: {
        eventId,
        userId: user.id,
        fullName: "Synthetic Ihyaa Member",
        email: user.email,
        city: "Rabat",
        age: 25,
        confirmed: false,
        status: "PENDING",
      },
    });
    bookingId = booking.id;

    await loginAdmin(page);
    await page.goto("/admin/bookings");
    const approveButton = page.getByTestId(`approve-btn-${booking.id}`);
    await expect(approveButton).toBeVisible({ timeout: 30_000 });
    await approveButton.click();

    await expect(page.getByTestId(`booking-status-${booking.id}`)).toContainText(
      /Confirmed|مؤكد/i,
      { timeout: 15_000 },
    );
    await expect(approveButton).toHaveCount(0);

    const persisted = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(persisted?.status).toBe("CONFIRMED");
    expect(persisted?.confirmed).toBe(true);

    const approvalAudits = await prisma.auditLog.findMany({
      where: { targetId: booking.id, action: "BOOKING_APPROVE" },
    });
    expect(approvalAudits).toHaveLength(1);
    expect(approvalAudits[0].details).toMatchObject({ approvalEmailSent: false });

    const mailFailureAudits = await prisma.auditLog.findMany({
      where: { targetId: booking.id, action: "BOOKING_APPROVAL_EMAIL_FAILED" },
    });
    expect(mailFailureAudits).toHaveLength(1);
  } finally {
    assertDevBranchDatabase("Booking approval email cleanup");
    if (bookingId) {
      await prisma.auditLog.deleteMany({ where: { targetId: bookingId } });
      await prisma.booking.deleteMany({ where: { id: bookingId } });
    }
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await removeSyntheticUser(user.id);
  }
});
