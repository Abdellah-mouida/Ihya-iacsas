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

  test("6. scripts/set-role.ts promotes user, writes audit log, and claims first admin setting", async () => {
    test.setTimeout(90000);
    const testEmail = `role.test.${Date.now()}@ihyaa.org`;

    // Create a temporary user with default USER role
    const testUser = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Role Test User",
        role: "USER",
        emailVerified: new Date(),
      },
    });

    try {
      // 1. Promote to MODERATOR via CLI
      execSync(`npx tsx scripts/set-role.ts ${testEmail} MODERATOR --reason "Test moderator promotion"`, {
        stdio: "pipe",
      });

      const updatedUser1 = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser1?.role).toBe("MODERATOR");

      // Verify AuditLog entry
      const log1 = await prisma.auditLog.findFirst({
        where: { targetId: testUser.id, action: "ROLE_CHANGE" },
        orderBy: { createdAt: "desc" },
      });
      expect(log1).toBeTruthy();
      expect((log1?.details as any)?.oldRole).toBe("USER");
      expect((log1?.details as any)?.newRole).toBe("MODERATOR");
      expect((log1?.details as any)?.reason).toBe("Test moderator promotion");

      // 2. Promote to ADMIN via CLI
      execSync(`npx tsx scripts/set-role.ts ${testEmail} ADMIN --reason "Test admin promotion"`, {
        stdio: "pipe",
      });

      const updatedUser2 = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser2?.role).toBe("ADMIN");

      // 3. Setting same role is a no-op
      const output = execSync(`npx tsx scripts/set-role.ts ${testEmail} ADMIN`, {
        encoding: "utf-8",
      });
      expect(output).toContain("already has role");
    } finally {
      // Clean up test data
      await prisma.auditLog.deleteMany({ where: { targetId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
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
