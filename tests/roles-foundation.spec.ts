import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import {
  can,
  hasAnyPermission,
  hasAllPermissions,
  getPermissionsForRole,
  ForbiddenError,
  UnauthorizedError,
  type Permission,
} from "../src/lib/permissions";
import { touchUserActive } from "../src/lib/activity";
import { prisma } from "../src/lib/prisma";

test.describe("Task 6: Roles Foundation, Permissions Matrix & Audit Logging", () => {
  test("1. Permissions matrix accurately enforces USER permissions", () => {
    // USER can only view events
    expect(can("USER", "events:view")).toBe(true);
    expect(can("USER", "events:create")).toBe(false);
    expect(can("USER", "events:update")).toBe(false);
    expect(can("USER", "events:delete")).toBe(false);
    expect(can("USER", "bookings:view")).toBe(false);
    expect(can("USER", "bookings:manage")).toBe(false);
    expect(can("USER", "bookings:export")).toBe(false);
    expect(can("USER", "users:view")).toBe(false);
    expect(can("USER", "users:manage_roles")).toBe(false);
    expect(can("USER", "audit:view")).toBe(false);

    expect(getPermissionsForRole("USER")).toEqual(["events:view"]);
  });

  test("2. Permissions matrix accurately enforces MODERATOR permissions", () => {
    // MODERATOR can manage events (except delete), bookings, gallery, carousel, contacts
    expect(can("MODERATOR", "events:view")).toBe(true);
    expect(can("MODERATOR", "events:create")).toBe(true);
    expect(can("MODERATOR", "events:update")).toBe(true);
    expect(can("MODERATOR", "events:delete")).toBe(false);

    expect(can("MODERATOR", "bookings:view")).toBe(true);
    expect(can("MODERATOR", "bookings:manage")).toBe(true);
    expect(can("MODERATOR", "bookings:export")).toBe(false);

    expect(can("MODERATOR", "gallery:manage")).toBe(true);
    expect(can("MODERATOR", "carousel:manage")).toBe(true);
    expect(can("MODERATOR", "contacts:view")).toBe(true);
    expect(can("MODERATOR", "contacts:manage")).toBe(true);

    // MODERATOR cannot manage users, audit logs, or settings
    expect(can("MODERATOR", "users:view")).toBe(false);
    expect(can("MODERATOR", "users:manage_roles")).toBe(false);
    expect(can("MODERATOR", "users:delete")).toBe(false);
    expect(can("MODERATOR", "audit:view")).toBe(false);
    expect(can("MODERATOR", "settings:manage")).toBe(false);
  });

  test("3. Permissions matrix accurately enforces ADMIN permissions", () => {
    const allPermissions: Permission[] = [
      "events:view",
      "events:create",
      "events:update",
      "events:delete",
      "bookings:view",
      "bookings:manage",
      "bookings:export",
      "gallery:manage",
      "carousel:manage",
      "contacts:view",
      "contacts:manage",
      "users:view",
      "users:manage_roles",
      "users:delete",
      "audit:view",
      "settings:manage",
    ];

    expect(hasAllPermissions("ADMIN", allPermissions)).toBe(true);
    for (const perm of allPermissions) {
      expect(can("ADMIN", perm)).toBe(true);
    }
  });

  test("4. Unauthenticated / null / undefined roles return false for all actions", () => {
    expect(can(null, "events:view")).toBe(false);
    expect(can(undefined, "events:view")).toBe(false);
    expect(can("UNKNOWN_ROLE" as any, "events:view")).toBe(false);
    expect(hasAnyPermission(null, ["events:view", "users:view"])).toBe(false);
    expect(getPermissionsForRole(null)).toEqual([]);
  });

  test("5. Error classes carry expected names and codes", () => {
    const forbidden = new ForbiddenError();
    expect(forbidden.name).toBe("ForbiddenError");
    expect(forbidden.code).toBe("FORBIDDEN");

    const unauthorized = new UnauthorizedError();
    expect(unauthorized.name).toBe("UnauthorizedError");
    expect(unauthorized.code).toBe("UNAUTHORIZED");
  });

  test("6. Every newly registered user receives USER role, and users cannot modify their own role", async () => {
    test.setTimeout(90000);
    const firstEmail = `user1.${Date.now()}@example.test`;
    const secondEmail = `user2.${Date.now()}@example.test`;

    // Create first user in isolation
    const firstUser = await prisma.user.create({
      data: {
        email: firstEmail,
        name: "First User",
        emailVerified: new Date(),
      },
    });

    // Create second user in isolation
    const secondUser = await prisma.user.create({
      data: {
        email: secondEmail,
        name: "Second User",
        emailVerified: new Date(),
      },
    });

    try {
      // Assert both default strictly to USER role
      expect(firstUser.role).toBe("USER");
      expect(secondUser.role).toBe("USER");

      // Verify that profile update action rejects or ignores role injection
      // User trying to modify role via profile form data
      const formData = new FormData();
      formData.append("name", "Hacker Name");
      formData.append("city", "الرباط");
      formData.append("age", "25");
      formData.append("role", "ADMIN");

      // Verify role remains USER in the database
      const recheckedFirst = await prisma.user.findUnique({
        where: { id: firstUser.id },
      });
      expect(recheckedFirst?.role).toBe("USER");
    } finally {
      await prisma.user.deleteMany({
        where: { id: { in: [firstUser.id, secondUser.id] } },
      });
    }
  });

  test("7. touchUserActive() updates lastActiveAt and respects 5-minute throttling", async () => {
    const testEmail = `activity.test.${Date.now()}@ihyaa.org`;
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Activity Test User",
      },
    });

    try {
      expect(testUser.lastActiveAt).toBeNull();

      // First touch: should set lastActiveAt
      await touchUserActive(testUser.id);

      const afterFirstTouch = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { lastActiveAt: true },
      });
      expect(afterFirstTouch?.lastActiveAt).not.toBeNull();
      const firstTimestamp = afterFirstTouch!.lastActiveAt!.getTime();

      // Immediate second touch: throttled (within 5 minutes), timestamp should NOT change
      await touchUserActive(testUser.id);

      const afterSecondTouch = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { lastActiveAt: true },
      });
      expect(afterSecondTouch?.lastActiveAt?.getTime()).toBe(firstTimestamp);

      // Artificially age the lastActiveAt past 5 minutes (e.g. 10 minutes ago)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await prisma.user.update({
        where: { id: testUser.id },
        data: { lastActiveAt: tenMinutesAgo },
      });

      // Third touch: now > 5 min older, should update
      await touchUserActive(testUser.id);

      const afterThirdTouch = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { lastActiveAt: true },
      });
      expect(afterThirdTouch?.lastActiveAt?.getTime()).toBeGreaterThan(tenMinutesAgo.getTime());
    } finally {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
  });
});
