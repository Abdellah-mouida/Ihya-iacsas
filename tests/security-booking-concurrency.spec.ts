import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";
import { createBookingForUser, cancelBookingForUser } from "../src/lib/services/bookings";
import { confirmBookingAndNotify } from "../src/lib/booking-promotion";

assertDevBranchDatabase("Booking & waitlist concurrency regression tests");

test.describe("Booking capacity & waitlist concurrency", () => {
  test.setTimeout(60_000);

  test("serializes waitlist order, double admin approval, and cancel waitlist promotion", async () => {
    const suffix = randomBytes(6).toString("hex");
    const users = await Promise.all([
      createSyntheticUser("Concurrency user A"),
      createSyntheticUser("Concurrency user B"),
      createSyntheticUser("Concurrency user C"),
      createSyntheticUser("Concurrency user D"),
      createSyntheticUser("Concurrency admin"),
    ]);

    for (let i = 0; i < users.length; i++) {
      await prisma.user.update({
        where: { id: users[i].id },
        data: {
          city: "الرباط",
          age: 23,
          onboardingCompletedAt: new Date(),
          ...(i === 4 ? { role: "ADMIN" } : {}),
        },
      });
    }

    const limitedEvent = await prisma.event.create({
      data: {
        titleAr: `فعالية محدودة ${suffix}`,
        titleEn: `Concurrency Limited ${suffix}`,
        slug: `conc-lim-${suffix}`,
        descriptionAr: "وصف",
        descriptionEn: "desc",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        time: "12:00",
        location: "الرباط",
        posterUrl: "/images/logo.png",
        capacity: 1,
        capacityType: "LIMITED",
        bookingOpen: true,
      },
    });

    try {
      // 1. Two PENDING bookings -> simultaneous admin approvals: only 1 can claim capacity=1
      const limA = await createBookingForUser({
        userId: users[0].id,
        eventId: limitedEvent.id,
        motive: "Motive 1",
        locale: "en",
      });
      const limB = await createBookingForUser({
        userId: users[1].id,
        eventId: limitedEvent.id,
        motive: "Motive 2",
        locale: "en",
      });
      expect(limA.status).toBe("PENDING");
      expect(limB.status).toBe("PENDING");

      const [bA, bB] = await Promise.all([
        prisma.booking.findUniqueOrThrow({
          where: { id: limA.bookingId! },
          include: { event: true, user: { select: { locale: true } } },
        }),
        prisma.booking.findUniqueOrThrow({
          where: { id: limB.bookingId! },
          include: { event: true, user: { select: { locale: true } } },
        }),
      ]);

      const actor = { id: users[4].id, email: users[4].email, role: "ADMIN" };
      const [appA, appB] = await Promise.all([
        confirmBookingAndNotify(bA, actor, "BOOKING_APPROVE"),
        confirmBookingAndNotify(bB, actor, "BOOKING_APPROVE"),
      ]);

      const claimed = [appA, appB].filter((r) => r.changed && !r.capacityFull);
      const rejectedByCapacity = [appA, appB].filter((r) => r.capacityFull);
      expect(claimed).toHaveLength(1);
      expect(rejectedByCapacity).toHaveLength(1);
      expect(
        await prisma.booking.count({ where: { eventId: limitedEvent.id, status: "CONFIRMED" } }),
      ).toBe(1);

      const confirmedBookingId = appA.changed ? limA.bookingId! : limB.bookingId!;
      const confirmedUser = appA.changed ? users[0] : users[1];

      // 2. Two simultaneous waitlist bookings on full event: strictly sequential waitlistOrder [1, 2]
      const [waitC, waitD] = await Promise.all([
        createBookingForUser({
          userId: users[2].id,
          eventId: limitedEvent.id,
          motive: "Wait 1",
          locale: "en",
        }),
        createBookingForUser({
          userId: users[3].id,
          eventId: limitedEvent.id,
          motive: "Wait 2",
          locale: "en",
        }),
      ]);
      expect(waitC.status).toBe("WAITLISTED");
      expect(waitD.status).toBe("WAITLISTED");
      expect([waitC.waitlistOrder, waitD.waitlistOrder].sort()).toEqual([1, 2]);

      // 3. Concurrent cancellation of the confirmed booking promotes only #1 waitlisted
      const [cancel1, cancel2] = await Promise.all([
        cancelBookingForUser({ userId: confirmedUser.id, bookingId: confirmedBookingId }),
        cancelBookingForUser({ userId: confirmedUser.id, bookingId: confirmedBookingId }),
      ]);
      expect([cancel1.success, cancel2.success].sort()).toEqual([false, true]);

      const confirmedAfterCancel = await prisma.booking.findMany({
        where: { eventId: limitedEvent.id, status: "CONFIRMED" },
      });
      const waitlistedAfterCancel = await prisma.booking.findMany({
        where: { eventId: limitedEvent.id, status: "WAITLISTED" },
      });
      expect(confirmedAfterCancel).toHaveLength(1);
      expect(waitlistedAfterCancel).toHaveLength(1);

      const firstWaitlistedBookingId =
        waitC.waitlistOrder === 1 ? waitC.bookingId! : waitD.bookingId!;
      expect(confirmedAfterCancel[0].id).toBe(firstWaitlistedBookingId);
    } finally {
      await prisma.notification.deleteMany({
        where: { userId: { in: users.map((u) => u.id) } },
      });
      await prisma.booking.deleteMany({
        where: { eventId: limitedEvent.id },
      });
      await prisma.event.deleteMany({
        where: { id: limitedEvent.id },
      });
      for (const u of users) {
        await removeSyntheticUser(u.id);
      }
    }
  });
});
