import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { prisma } from "../src/lib/prisma";

assertDevBranchDatabase("Booking legacy OTP removal regression test");

test.describe("Booking dead OTP actions removal (IHY-SEC-003)", () => {
  test("unauthenticated booking OTP actions, cross-event deleteMany, and hardcoded OTP secret are removed", () => {
    const actionsSource = readFileSync(
      path.join(process.cwd(), "src/app/actions/bookings.ts"),
      "utf8",
    );
    const serviceSource = readFileSync(
      path.join(process.cwd(), "src/lib/services/bookings.ts"),
      "utf8",
    );
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+requestBookingOtp\b/);
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+verifyBookingOtp\b/);
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+resendBookingOtp\b/);
    expect(actionsSource).not.toContain("ihyaa-secure-production-salt-2026");
    expect(actionsSource).not.toMatch(/deleteMany\([^)]*confirmed:\s*false/);
    expect(serviceSource).not.toMatch(/deleteMany\([^)]*confirmed:\s*false/);
    expect(serviceSource).toContain('from "@/lib/rate-limit"');
  });

  test("unauthenticated visitor to booking route is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/book", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unconfirmed bookings are preserved when visiting event booking route", async ({
    page,
  }) => {
    const unique = randomBytes(5).toString("hex");
    const email = `booking-keep-${unique}@example.test`;

    const event = await prisma.event.create({
      data: {
        slug: `sec-otp-removed-${unique}`,
        titleAr: "فعالية اختبار",
        titleEn: "Security Test Event",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
        date: new Date("2030-06-01T18:00:00Z"),
        time: "18:00",
        location: "Tetouan",
        posterUrl: "/images/event-poster.jpg",
        capacityType: "LIMITED",
        capacity: 5,
        bookingOpen: true,
      },
    });

    const user = await prisma.user.create({
      data: {
        email,
        name: "Booking Victim",
        role: "USER",
        emailVerified: new Date(),
        onboardingCompletedAt: new Date(),
        city: "تطوان",
        age: 22,
      },
    });

    const pendingBooking = await prisma.booking.create({
      data: {
        eventId: event.id,
        userId: user.id,
        fullName: user.name!,
        email,
        city: "تطوان",
        age: 22,
        confirmed: false,
        status: "PENDING",
      },
    });

    try {
      await page.goto(`/events/${event.slug}/book`);
      await expect(page.locator("body")).toBeVisible();

      const stillExists = await prisma.booking.findUnique({
        where: { id: pendingBooking.id },
      });
      expect(stillExists?.id).toBe(pendingBooking.id);
      expect(stillExists?.status).toBe("PENDING");
    } finally {
      await prisma.booking.deleteMany({ where: { eventId: event.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
      await prisma.event.deleteMany({ where: { id: event.id } });
    }
  });
});
