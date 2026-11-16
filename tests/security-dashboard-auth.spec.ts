import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "../src/lib/permissions";
import { fetchDashboardStatsForActor } from "../src/lib/services/dashboard";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import {
  TEST_ADMIN,
  TEST_MODERATOR,
  TEST_REGULAR_USER,
  ensureTestUser,
  loginAs,
} from "./helpers/admin-auth";

assertDevBranchDatabase("Dashboard authorization and PII minimization tests");

test.describe("IHY-SEC-002: Dashboard booking exposure authorization", () => {
  test.setTimeout(60_000);

  let testEventId = "";
  let testBookingId = "";

  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
    await ensureTestUser(TEST_MODERATOR);
    await ensureTestUser(TEST_REGULAR_USER);

    const slug = `sec-dash-${randomBytes(4).toString("hex")}`;
    const event = await prisma.event.create({
      data: {
        slug,
        titleAr: "فعالية اختبار",
        titleEn: "Security Test Event",
        descriptionAr: "وصف",
        descriptionEn: "Desc",
        date: new Date("2026-12-01T10:00:00.000Z"),
        time: "10:00",
        location: "الرباط",
        posterUrl: "/images/logo.png",
        bookingOpen: true,
      },
    });
    testEventId = event.id;

    const booking = await prisma.booking.create({
      data: {
        eventId: event.id,
        fullName: "Secret Attendee",
        email: `secret.attendee.${randomBytes(4).toString("hex")}@example.test`,
        age: 29,
        city: "الرباط",
        motive: "Sensitive private booking motive",
        confirmed: true,
        status: "CONFIRMED",
      },
    });
    testBookingId = booking.id;
  });

  test.afterAll(async () => {
    if (testBookingId) {
      await prisma.booking.deleteMany({ where: { id: testBookingId } });
    }
    if (testEventId) {
      await prisma.event.deleteMany({ where: { id: testEventId } });
    }
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [TEST_ADMIN.email, TEST_MODERATOR.email, TEST_REGULAR_USER.email],
        },
      },
    });
  });

  test("rejects anonymous and USER actors while returning only redacted fields to MODERATOR/ADMIN", async () => {
    await expect(fetchDashboardStatsForActor(null)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(
      fetchDashboardStatsForActor({ id: "u-1", role: "USER" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    for (const role of ["MODERATOR", "ADMIN"] as const) {
      const res = await fetchDashboardStatsForActor({ id: "u-2", role });
      expect(res.stats.totalBookingsCount).toBeGreaterThanOrEqual(1);
      expect(res.recentBookings.length).toBeGreaterThanOrEqual(1);
      const sample = res.recentBookings[0] as Record<string, unknown>;
      expect("age" in sample).toBe(false);
      expect("motive" in sample).toBe(false);
      expect("userId" in sample).toBe(false);
      expect("status" in sample).toBe(false);
      expect("confirmed" in sample).toBe(false);
      expect("approvedById" in sample).toBe(false);
      expect(Object.keys(sample).sort()).toEqual([
        "city",
        "createdAt",
        "email",
        "event",
        "fullName",
        "id",
      ]);
    }
  });

  test("ADMIN loads /admin overview with recent booking and USER is blocked at /403", async ({
    browser,
  }) => {
    const adminCtx = await browser.newContext();
    const userCtx = await browser.newContext();

    try {
      const adminPage = await adminCtx.newPage();
      await loginAs(adminPage, TEST_ADMIN, "/admin");
      await expect(adminPage).toHaveURL(/\/admin$/);
      await expect(adminPage.locator("text=Secret Attendee")).toBeVisible({
        timeout: 15_000,
      });

      const userPage = await userCtx.newPage();
      await loginAs(userPage, TEST_REGULAR_USER, "/admin");
      await expect(userPage).toHaveURL(/\/403/);
      await expect(userPage.locator("text=Secret Attendee")).toHaveCount(0);
    } finally {
      await adminCtx.close();
      await userCtx.close();
    }
  });
});
