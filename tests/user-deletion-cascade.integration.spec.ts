import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { deleteUserAccount } from "../src/lib/user-deletion";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

test.describe("User deletion cascade and waitlist promotion", () => {
  test.setTimeout(120_000);

  test("deletes bookings, promotes the next attendee, sends email, and preserves audit snapshots", async () => {
    assertDevBranchDatabase("User deletion cascade integration test");
    const suffix = randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);
    let targetUserId: string | undefined;
    let waitingUserId: string | undefined;
    let eventId: string | undefined;
    let waitingBookingId: string | undefined;

    try {
      const target = await prisma.user.create({
        data: {
          email: `delete-target-${suffix}@example.test`,
          name: "Synthetic Deletion Target",
          passwordHash,
          role: "USER",
        },
        select: { id: true, email: true, name: true },
      });
      targetUserId = target.id;

      const waitingUser = await prisma.user.create({
        data: {
          email: `delete-waitlist-${suffix}@example.test`,
          name: "Synthetic Waitlisted Member",
          passwordHash,
          role: "USER",
        },
        select: { id: true, email: true, name: true },
      });
      waitingUserId = waitingUser.id;

      const event = await prisma.event.create({
        data: {
          slug: `delete-test-${suffix}`,
          titleAr: "فعالية اختبار الحذف",
          titleEn: "Deletion Test Event",
          descriptionAr: "اختبار تكاملي",
          descriptionEn: "Integration test",
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          time: "18:00",
          location: "Synthetic Test Location",
          posterUrl: "https://example.test/poster.png",
          capacityType: "LIMITED",
          capacity: 1,
        },
        select: { id: true },
      });
      eventId = event.id;

      await prisma.booking.create({
        data: {
          eventId,
          userId: target.id,
          fullName: target.name!,
          email: target.email!,
          city: "Synthetic City",
          age: 25,
          status: "CONFIRMED",
          confirmed: true,
        },
      });
      const waitingBooking = await prisma.booking.create({
        data: {
          eventId,
          userId: waitingUser.id,
          fullName: waitingUser.name!,
          email: waitingUser.email!,
          city: "Synthetic City",
          age: 24,
          status: "WAITLISTED",
          confirmed: false,
          waitlistOrder: 1,
        },
        select: { id: true },
      });
      waitingBookingId = waitingBooking.id;

      await prisma.auditLog.create({
        data: {
          actorId: target.id,
          action: "BOOKING_CREATED",
          targetType: "Booking",
          targetId: "synthetic-history-target",
          details: { eventId },
        },
      });

      const sentTo: string[] = [];
      const result = await deleteUserAccount(
        {
          targetUserId: target.id,
          actorId: target.id,
          action: "ACCOUNT_DELETE",
        },
        {
          sendEmail: async (to) => {
            sentTo.push(to);
            return { success: true };
          },
        },
      );

      expect(result.success).toBe(true);
      expect(await prisma.user.findUnique({ where: { id: target.id }, select: { id: true } })).toBeNull();
      expect(await prisma.booking.count({ where: { userId: target.id } })).toBe(0);
      expect(await prisma.booking.count({ where: { id: waitingBooking.id, status: "CONFIRMED", confirmed: true } })).toBe(1);
      expect(sentTo).toEqual([waitingUser.email]);

      const auditRows = await prisma.auditLog.findMany({
        where: {
          OR: [
            { targetId: target.id },
            { targetId: waitingBooking.id },
            { action: "ACCOUNT_DELETE", targetId: target.id },
            { actorEmail: target.email },
          ],
        },
        orderBy: { createdAt: "asc" },
      });
      const historical = auditRows.find((row) => row.action === "BOOKING_CREATED");
      const deletion = auditRows.find((row) => row.action === "ACCOUNT_DELETE");
      expect(historical).toMatchObject({
        actorId: null,
        actorName: target.name,
        actorEmail: target.email,
      });
      expect(deletion).toMatchObject({
        actorId: null,
        actorName: target.name,
        actorEmail: target.email,
        targetId: target.id,
        targetName: target.name,
        targetEmail: target.email,
      });
      expect(auditRows.some((row) => row.targetId === waitingBooking.id && row.action === "BOOKING_PROMOTE_WAITLIST")).toBe(true);
    } finally {
      if (eventId) await prisma.booking.deleteMany({ where: { eventId } });
      if (targetUserId || waitingBookingId) {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              ...(targetUserId ? [{ targetId: targetUserId }, { actorId: targetUserId }] : []),
              ...(targetUserId ? [{ actorEmail: `delete-target-${suffix}@example.test` }] : []),
              ...(waitingBookingId ? [{ targetId: waitingBookingId }] : []),
            ],
          },
        });
      }
      if (eventId) await prisma.event.deleteMany({ where: { id: eventId } });
      await prisma.user.deleteMany({ where: { id: { in: [targetUserId, waitingUserId].filter((id): id is string => Boolean(id)) } } });
    }
  });

  test("Settings confirms self-deletion and signs the member out", async ({ page }) => {
    assertDevBranchDatabase("Settings self-deletion E2E");
    const suffix = randomBytes(16).toString("hex");
    const email = `settings-delete-${suffix}@example.test`;
    const password = randomBytes(32).toString("base64url");
    const user = await prisma.user.create({
      data: {
        email,
        name: "Synthetic Settings Deletion Member",
        passwordHash: await bcrypt.hash(password, 12),
        emailVerified: new Date(),
        city: "Synthetic City",
        age: 26,
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        onboardingCompletedAt: new Date(),
      },
      select: { id: true },
    });

    try {
      await page.goto("/login?callbackUrl=%2Fsettings");
      await page.fill('[data-testid="login-email-input"]', email);
      await page.fill('[data-testid="login-password-input"]', password);
      await Promise.all([
        page.waitForURL((url) => url.pathname === "/settings", { timeout: 30_000 }),
        page.click('[data-testid="login-submit-btn"]'),
      ]);
      await page.goto("/settings?tab=privacy");
      await expect(page.locator('[data-testid="settings-privacy-section"]')).toBeVisible();

      await page.locator('[data-testid="settings-delete-account-btn"]').click();
      await expect(page.locator('[data-testid="settings-delete-account-dialog"]')).toBeVisible();
      await page.locator('[data-testid="settings-delete-account-cancel"]').click();
      await expect(page.locator('[data-testid="settings-delete-account-dialog"]')).toBeHidden();
      expect(await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } })).not.toBeNull();

      await page.locator('[data-testid="settings-delete-account-btn"]').click();
      await page.locator('[data-testid="settings-delete-account-confirm"]').click();
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 });
      expect(await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } })).toBeNull();
      await expect.poll(() => prisma.auditLog.findFirst({
        where: { action: "SIGN_OUT", actorEmail: email },
      })).toMatchObject({ actorId: null, actorName: "Synthetic Settings Deletion Member", actorEmail: email });
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorEmail: email } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
  });
});
