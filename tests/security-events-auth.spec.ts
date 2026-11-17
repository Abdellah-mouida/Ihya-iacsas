import { test, expect } from "@playwright/test";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { fetchAdminEventsForActor } from "../src/lib/services/events";
import { ForbiddenError, UnauthorizedError } from "../src/lib/permissions";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";
import { loginAs } from "./helpers/admin-auth";
import { prisma } from "../src/lib/prisma";

assertDevBranchDatabase("Admin events authorization security regression test");

test.describe("Admin events authorization (IHY-SEC-003)", () => {
  test.setTimeout(60_000);

  test("unit: fetchAdminEventsForActor rejects anonymous and USER, and omits raw booking rows", async () => {
    await expect(fetchAdminEventsForActor(null)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(
      fetchAdminEventsForActor({ id: "u1", role: "USER" }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const events = await fetchAdminEventsForActor({ id: "admin-1", role: "ADMIN" });
    expect(Array.isArray(events)).toBe(true);
    for (const ev of events) {
      expect("bookings" in ev).toBe(false);
    }
  });

  test("e2e: USER cannot load /admin/events while ADMIN can view events table", async ({
    browser,
    baseURL,
  }) => {
    const regularUser = await createSyntheticUser("Regular user events denial");
    const adminUser = await createSyntheticUser("Admin events access");
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { role: "ADMIN", onboardingCompletedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: regularUser.id },
      data: { onboardingCompletedAt: new Date() },
    });

    const userContext = await browser.newContext({ baseURL });
    const adminContext = await browser.newContext({ baseURL });

    try {
      const userPage = await userContext.newPage();
      await loginAs(userPage, regularUser, "/admin/events");
      await userPage.waitForURL(/\/403/, { timeout: 15_000 });
      expect(userPage.url()).toContain("/403");

      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, adminUser, "/admin/events");
      await expect(adminPage.locator('[data-testid="create-event-btn"]')).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await userContext.close();
      await adminContext.close();
      await removeSyntheticUser(regularUser.id);
      await removeSyntheticUser(adminUser.id);
    }
  });
});
