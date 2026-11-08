import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

test("ADMIN views localized, filtered, cursor-paginated user activity", async ({ page }) => {
  assertDevBranchDatabase("Admin user activity view E2E");
  test.setTimeout(300_000);

  const suffix = randomBytes(16).toString("hex");
  const adminEmail = `activity-admin-${suffix}@example.test`;
  const targetEmail = `activity-member-${suffix}@example.test`;
  const password = randomBytes(32).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Synthetic Activity Admin",
      passwordHash,
      role: "ADMIN",
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
    },
    select: { id: true, email: true, name: true },
  });
  const target = await prisma.user.create({
    data: {
      email: targetEmail,
      name: "Synthetic Activity Member",
      passwordHash,
      role: "USER",
      emailVerified: new Date(),
      city: "Casablanca",
      age: 23,
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
    },
    select: { id: true, email: true, name: true },
  });

  try {
    const now = Date.now();
    await prisma.auditLog.createMany({
      data: [...Array.from({ length: 23 }, (_, index) => ({
        actorId: target.id,
        actorName: target.name!,
        actorEmail: target.email!,
        action: "BOOKING_CREATED",
        targetType: "Booking",
        targetId: `synthetic-activity-booking-${suffix}-${index}`,
        targetName: `Synthetic Activity Event ${index + 1}`,
        details: { eventTitle: `Synthetic Activity Event ${index + 1}`, status: "PENDING" },
        createdAt: new Date(now - index * 60_000),
      })), {
        actorId: admin.id,
        actorName: admin.name!,
        actorEmail: admin.email!,
        action: "USER_ROLE_UPDATE",
        targetType: "User",
        targetId: target.id,
        targetName: target.name,
        targetEmail: target.email,
        details: { previousRole: "USER", newRole: "ADMIN" },
        createdAt: new Date(now - 23 * 60_000),
      }, {
        actorId: target.id,
        actorName: target.name!,
        actorEmail: target.email!,
        action: "SIGN_IN_GOOGLE",
        targetType: "User",
        targetId: target.id,
        targetName: target.name,
        targetEmail: target.email,
        details: Prisma.JsonNull,
        createdAt: new Date(now - 24 * 60 * 60_000),
      }],
    });

    await page.goto(`/login?callbackUrl=${encodeURIComponent("/admin/users")}`);
    await page.fill('[data-testid="login-email-input"]', adminEmail);
    await page.fill('[data-testid="login-password-input"]', password);
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin/users", { timeout: 30_000 }),
      page.click('[data-testid="login-submit-btn"]'),
    ]);
    if (await page.locator("html").getAttribute("dir") !== "ltr") {
      await page.locator('[data-testid="language-switcher-btn"]').click();
    }
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    await page.locator('[data-testid="users-search-input"]').fill(targetEmail);
    await page.locator('[data-testid="users-search-input"]').press("Enter");
    await page.locator(`[data-testid="user-actions-btn-${target.id}"]`).click();
    await page.locator(`[data-testid="view-user-${target.id}"]`).click();

    const dialog = page.locator('[data-testid="user-details-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(target.name!);
    const close = dialog.locator('[data-slot="dialog-close"]');
    await expect.poll(async () => (await close.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
    await expect.poll(async () => (await close.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    const bounds = await close.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);

    await page.locator('[data-testid="view-user-activity-button"]').click();
    const activityHeading = page.locator('[data-testid="user-details-view-heading"]');
    await expect(activityHeading).toBeFocused();
    await expect(activityHeading).toContainText("User activity");
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
    await expect(page.locator('[data-testid="activity-row"]').first()).toContainText("Synthetic Activity Event 1");
    const timeText = await page.locator('[data-testid="activity-exact-time"]').first().innerText();
    expect(timeText).toMatch(/:\d{2}.*GMT/i);

    await page.locator('[data-testid="activity-action-filter"]').click();
    await page.getByRole("option", { name: "Signed in with Google" }).click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="activity-row"]').first()).toContainText("Signed in with Google");

    await page.locator('[data-testid="activity-action-filter"]').click();
    await page.getByRole("option", { name: "All actions" }).click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20);
    await page.locator('[data-testid="activity-load-more"]').click();
    await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(25);
    await page.locator('[data-testid="activity-action-filter"]').click();
    await page.getByRole("option", { name: "User role changed" }).first().click();
    await expect(page.locator('[data-testid="activity-row"]')).toContainText("Member → Admin");

    await page.locator('[data-testid="activity-back-button"]').click();
    await expect(page.locator('[data-testid="user-info-view"]')).toBeVisible();
    await expect(dialog).toContainText("Casablanca");

    const screenshotDir = join(process.cwd(), "evidence/task-8");
    await mkdir(screenshotDir, { recursive: true });
    for (const locale of ["ar", "en"] as const) {
      await page.evaluate((nextLocale) => localStorage.setItem("ihyaa-locale", nextLocale), locale);
      await page.reload();
      await expect(page.locator('[data-testid="admin-users-page"]')).toBeVisible();
      const expectedDirection = locale === "ar" ? "rtl" : "ltr";
      if (await page.locator("html").getAttribute("dir") !== expectedDirection) {
        await page.locator('[data-testid="language-switcher-btn"]').click();
      }
      await expect(page.locator("html")).toHaveAttribute("dir", expectedDirection);
      await page.locator('[data-testid="users-search-input"]').fill(targetEmail);
      await page.locator('[data-testid="users-search-input"]').press("Enter");
      for (const width of [320, 360, 768, 1440] as const) {
        await page.setViewportSize({ width, height: 900 });
        if (width < 768) {
          await page.locator('[data-testid="view-user-card-' + target.id + '"]').click();
        } else {
          await page.locator('[data-testid="user-actions-btn-' + target.id + '"]').click();
          await page.locator('[data-testid="view-user-' + target.id + '"]').click();
        }
        await expect(dialog).toBeVisible();
        await page.locator('[data-testid="view-user-activity-button"]').click();
        await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20, { timeout: 30_000 });
        if (locale === "ar" && width === 320) {
          await page.locator('[data-testid="activity-action-filter"]').click();
          await page.getByRole("option", { name: "تغيير دور المستخدم" }).first().click();
          await expect(page.locator('[data-testid="activity-row"]')).toContainText("عضو → مدير");
          await page.locator('[data-testid="activity-action-filter"]').click();
          await page.getByRole("option", { name: "جميع الإجراءات" }).first().click();
          await expect(page.locator('[data-testid="activity-row"]')).toHaveCount(20);
        }
        for (const theme of ["light", "sunset", "amoled", "black"] as const) {
          await page.evaluate((selectedTheme) => {
            document.documentElement.setAttribute("data-theme", selectedTheme);
            document.documentElement.classList.toggle("dark", selectedTheme === "amoled" || selectedTheme === "black");
          }, theme);
          if (locale === "ar") {
            await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
            await expect(page.locator('[data-testid="activity-action-filter"]')).toContainText("جميع الإجراءات");
          } else {
            await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
            await expect(page.locator('[data-testid="activity-action-filter"]')).toContainText("All actions");
          }
          await page.screenshot({
            path: join(screenshotDir, "admin-user-activity-" + locale + "-" + theme + "-" + width + ".png"),
            fullPage: false,
          });
          const bounds = await dialog.boundingBox();
          expect(bounds?.x).toBeGreaterThanOrEqual(0);
          expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width + 1);
        }
        await page.locator('[data-slot="dialog-close"]').click();
      }
    }
  } finally {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { in: [admin.id, target.id] } },
          { actorEmail: { in: [adminEmail, targetEmail] } },
          { targetId: target.id },
          { targetId: { startsWith: `synthetic-activity-booking-${suffix}-` } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, target.id] } } });
  }
});
