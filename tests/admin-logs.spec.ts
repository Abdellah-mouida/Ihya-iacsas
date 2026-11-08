import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

test("ADMIN searches, filters, and pages activity logs; moderator is denied", async ({ page }) => {
  assertDevBranchDatabase("Admin logs E2E");
  test.setTimeout(300_000);

  const suffix = randomBytes(16).toString("hex");
  const adminEmail = `logs-admin-${suffix}@example.test`;
  const moderatorEmail = `logs-moderator-${suffix}@example.test`;
  const memberEmail = `logs-member-${suffix}@example.test`;
  const deletedEmail = `logs-deleted-${suffix}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const [admin, moderator, member, deleted] = await Promise.all([
    prisma.user.create({
      data: { email: adminEmail, name: "Synthetic Logs Admin", passwordHash, role: "ADMIN", emailVerified: new Date(), onboardingCompletedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: "2026-10-11" },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.create({
      data: { email: moderatorEmail, name: "Synthetic Logs Moderator", passwordHash, role: "MODERATOR", emailVerified: new Date(), onboardingCompletedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: "2026-10-11" },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.create({
      data: { email: memberEmail, name: "Synthetic Logs Member", passwordHash, role: "USER", emailVerified: new Date(), onboardingCompletedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: "2026-10-11" },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.create({
      data: { email: deletedEmail, name: "Synthetic Deleted Member", passwordHash, role: "USER", emailVerified: new Date(), onboardingCompletedAt: new Date(), termsAcceptedAt: new Date(), termsVersion: "2026-10-11" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  try {
    const now = Date.now();
    await prisma.auditLog.createMany({
      data: [
        ...Array.from({ length: 23 }, (_, index) => ({
          actorId: member.id,
          actorName: member.name,
          actorEmail: member.email,
          action: "BOOKING_CREATED",
          targetType: "Event",
          targetId: `synthetic-logs-event-${suffix}-${index}`,
          targetName: `Synthetic Logs Event ${index + 1}`,
          targetEmail: null,
          details: { eventTitle: `Synthetic Logs Event ${index + 1}` },
          createdAt: new Date(now - index * 60_000),
        })),
        {
          actorId: deleted.id,
          actorName: deleted.name,
          actorEmail: deleted.email,
          actorRole: "USER",
          action: "SIGN_UP",
          targetType: "User",
          targetId: deleted.id,
          targetName: deleted.name,
          targetEmail: deleted.email,
          details: Prisma.JsonNull,
          createdAt: new Date(now - 23 * 60_000),
        },
      ],
    });
    await prisma.user.delete({ where: { id: deleted.id } });

    await page.goto(`/login?callbackUrl=${encodeURIComponent("/admin/logs")}`);
    await page.fill('[data-testid="login-email-input"]', adminEmail);
    await page.fill('[data-testid="login-password-input"]', password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin/logs", { timeout: 30_000 }),
      page.locator('[data-testid="login-submit-btn"]').click(),
    ]);
    if (await page.locator("html").getAttribute("dir") !== "ltr") {
      await page.locator('[data-testid="language-switcher-btn"]').click();
    }
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await expect(page.locator('[data-testid="admin-logs-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-logs-page"]')).toContainText("Activity logs");
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Logs", exact: true })).toBeVisible();
    await page.locator('[data-testid="admin-logs-user-search"]').fill(member.email!);
    await page.locator('[data-testid="admin-logs-apply"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await expect(page.locator('[data-testid="activity-row"]').first()).toContainText("Synthetic Logs Event 1");
    const activeActorLink = page.locator('[data-testid="activity-row"]').first().getByRole("link", { name: member.name! });
    await expect(activeActorLink).toHaveAttribute("href", `/admin/users?search=${encodeURIComponent(member.email!)}`);
    await activeActorLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/users\\?search=${encodeURIComponent(member.email!)}`));
    await expect(page.locator('[data-testid="users-search-input"]')).toHaveValue(member.email!);

    await page.goto("/admin/logs");
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await page.locator('[data-testid="admin-logs-user-search"]').fill(member.email!);
    const currentDate = new Date().toISOString().slice(0, 10);
    await page.locator('[data-testid="admin-logs-from"]').fill(currentDate);
    await page.locator('[data-testid="admin-logs-to"]').fill(currentDate);
    await page.locator('[data-testid="admin-logs-apply"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await page.locator('[data-testid="activity-load-more"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(23);

    await page.locator('[data-testid="activity-action-filter"]').click();
    await page.getByRole("option", { name: "Booking created", exact: true }).first().click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await page.locator('[data-testid="activity-action-filter"]').click();
    await page.getByRole("option", { name: "All actions", exact: true }).first().click();

    await page.locator('[data-testid="admin-logs-user-search"]').fill(deleted.email!);
    await page.locator('[data-testid="admin-logs-from"]').fill("");
    await page.locator('[data-testid="admin-logs-to"]').fill("");
    await page.locator('[data-testid="admin-logs-apply"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(1, { timeout: 30_000 });
    const deletedRow = page.locator('[data-testid="activity-row"]').first();
    await expect(deletedRow).toContainText(deleted.name!);
    await expect(deletedRow).toContainText(deleted.email!);
    await expect(deletedRow).toContainText("Member");
    await expect(deletedRow).toContainText("Deleted account");
    await expect(deletedRow.getByRole("link")).toHaveCount(0);

    await page.locator('[data-testid="admin-logs-clear"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    const screenshotDir = join(process.cwd(), "evidence/task-9");
    await mkdir(screenshotDir, { recursive: true });
    for (const locale of ["ar", "en"] as const) {
      await page.evaluate((nextLocale) => localStorage.setItem("ihyaa-locale", nextLocale), locale);
      await page.reload();
      await expect(page.locator('[data-testid="admin-logs-page"]')).toBeVisible();
      const expectedDirection = locale === "ar" ? "rtl" : "ltr";
      if (await page.locator("html").getAttribute("dir") !== expectedDirection) {
        await page.locator('[data-testid="language-switcher-btn"]').click();
      }
      await expect(page.locator("html")).toHaveAttribute("dir", expectedDirection);
      await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
      for (const width of [360, 768, 1440] as const) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "sunset", "amoled", "black"] as const) {
          await page.evaluate((selectedTheme) => {
            document.documentElement.setAttribute("data-theme", selectedTheme);
            document.documentElement.classList.toggle("dark", selectedTheme === "amoled" || selectedTheme === "black");
          }, theme);
          await page.screenshot({ path: join(screenshotDir, `admin-logs-${locale}-${theme}-${width}.png`) });
          expect(await page.locator("body").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
        }
      }
    }

    await page.context().clearCookies();
    await page.goto(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
    await page.fill('[data-testid="login-email-input"]', moderatorEmail);
    await page.fill('[data-testid="login-password-input"]', password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin", { timeout: 30_000 }),
      page.locator('[data-testid="login-submit-btn"]').click(),
    ]);
    await expect(page.locator('[data-testid="admin-logs-page"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/logs"]')).toHaveCount(0);
    await page.goto("/admin/logs");
    await expect(page).toHaveURL(/\/403$/);
    await expect(page.locator("body")).toContainText("403");
  } finally {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: [admin.id, moderator.id, member.id, deleted.id] } },
          { actorEmail: { in: [adminEmail, moderatorEmail, memberEmail, deletedEmail] } },
          { targetId: { in: [admin.id, moderator.id, member.id, deleted.id] } },
          { targetId: { startsWith: `synthetic-logs-event-${suffix}-` } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, moderator.id, member.id] } } });
  }
});
