import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { loginAs } from "./helpers/admin-auth";

assertDevBranchDatabase("Realtime notifications E2E and API integration tests");

async function createTestUser(role: "USER" | "ADMIN", label: string) {
  const suffix = randomBytes(6).toString("hex");
  const email = `notif.${label}.${suffix}@example.test`;
  const password = `Notif-${randomBytes(12).toString("base64url")}!`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `${label}_${suffix}`,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      locale: "en",
      city: "الرباط",
      age: 23,
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: new Date(),
      chatTermsAcceptedAt: new Date(),
      sessionVersion: 1,
    },
    select: { id: true, email: true, name: true },
  });
  return {
    id: user.id,
    email: user.email!,
    name: user.name!,
    password,
  };
}

async function signInUser(
  page: Page,
  user: { email: string; password: string },
  targetPath = "/profile",
) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(targetPath)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('[data-testid="login-email-input"]').fill(user.email);
  await page.locator('[data-testid="login-password-input"]').fill(user.password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForURL(
    (url) => url.pathname === targetPath || url.pathname === "/profile",
    { timeout: 25_000 },
  );
  if (!new URL(page.url()).pathname.startsWith(targetPath)) {
    await page.goto(targetPath, { waitUntil: "domcontentloaded" });
  }
}

test.describe("13-T6: Stored & Realtime Notification System", () => {
  test.describe.configure({ timeout: 120_000 });

  test("API ownership isolation, chatEnabled=false personal token, online approval toast, and offline summary toast", async ({
    browser,
  }) => {
    const admin = await createTestUser("ADMIN", "admin");
    const onlineUser = await createTestUser("USER", "online");
    const offlineUser = await createTestUser("USER", "offline");

    const slug = `notif-camp-${randomBytes(5).toString("hex")}`;
    const event = await prisma.event.create({
      data: {
        slug,
        titleAr: "مخيم الإشعارات التجريبي",
        titleEn: "Notification Test Camp",
        descriptionAr: "وصف المخيم التجريبي",
        descriptionEn: "Test camp description",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        time: "10:00",
        location: "Rabat",
        posterUrl: "/images/event-poster-1.jpg",
        capacityType: "LIMITED",
        capacity: 5,
        bookingOpen: true,
      },
      select: { id: true, slug: true },
    });

    const bookingOnline = await prisma.booking.create({
      data: {
        eventId: event.id,
        userId: onlineUser.id,
        fullName: onlineUser.name,
        email: onlineUser.email,
        city: "الرباط",
        age: 23,
        status: "PENDING",
        confirmed: false,
      },
      select: { id: true },
    });

    const bookingOffline = await prisma.booking.create({
      data: {
        eventId: event.id,
        userId: offlineUser.id,
        fullName: offlineUser.name,
        email: offlineUser.email,
        city: "الرباط",
        age: 24,
        status: "PENDING",
        confirmed: false,
      },
      select: { id: true },
    });

    const chatSettingRow = await prisma.systemSetting.findUnique({
      where: { key: "chatEnabled" },
      select: { value: true },
    });
    const initialChatEnabled = chatSettingRow?.value === "true";
    const ctxOnline = await browser.newContext();
    const ctxAdmin = await browser.newContext();
    const ctxOffline = await browser.newContext();

    try {
      const pageOnline = await ctxOnline.newPage();
      const pageAdmin = await ctxAdmin.newPage();

      // 1. Online user signs in & connects realtime personal channel after first paint
      const tokenWait = pageOnline.waitForResponse(
        (res) =>
          res.url().includes("/api/chat/realtime/token") &&
          res.status() === 200,
        { timeout: 30_000 },
      );
      await signInUser(pageOnline, onlineUser, "/profile");
      const tokenRes = await tokenWait;
      const tokenJson = (await tokenRes.json()) as {
        channels?: string[];
      };
      expect(tokenJson.channels).toContain(`user:${onlineUser.id}`);

      // Wait briefly for EventSource / Ably subscription to complete handshake
      await pageOnline.waitForTimeout(800);

      // 2. Admin approves onlineUser's booking via /admin/bookings
      await loginAs(pageAdmin, admin, "/admin/bookings");
      const approveBtn = pageAdmin.locator(
        `[data-testid="approve-btn-${bookingOnline.id}"]`,
      );
      await expect(approveBtn).toBeVisible({ timeout: 20_000 });
      await approveBtn.click();
      await expect(
        pageAdmin.locator(`[data-testid="booking-status-${bookingOnline.id}"]`),
      ).toContainText(/CONFIRMED|مؤكد/i, { timeout: 20_000 });

      // Without reloading, onlineUser (default ar locale) receives realtime toast + unread avatar badge updates
      const toast = pageOnline.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible({ timeout: 15_000 });
      await expect(toast).toContainText(/مخيم الإشعارات التجريبي|Notification Test Camp/i);
      await expect(
        pageOnline.locator('[data-testid="navbar-avatar-unread-badge"]'),
      ).toBeVisible({ timeout: 10_000 });

      // 3. Cross-user API isolation + chatEnabled=false personal token verification
      const listRes = await pageOnline.request.get("/api/notifications?limit=10");
      expect(listRes.status()).toBe(200);
      const listJson = (await listRes.json()) as {
        items: Array<{ id: string; type: string; readAt: string | null }>;
        unreadCount: number;
      };
      expect(listJson.unreadCount).toBe(1);
      expect(listJson.items).toHaveLength(1);
      const onlineNotifId = listJson.items[0].id;

      // Unauthenticated request -> 401
      const unauthRes = await ctxOffline.request.get("/api/notifications");
      expect(unauthRes.status()).toBe(401);

      // Admin trying to read or mutate onlineUser's notification -> 404
      const crossGet = await pageAdmin.request.get(
        `/api/notifications/${onlineNotifId}`,
      );
      expect(crossGet.status()).toBe(404);
      const crossPatch = await pageAdmin.request.patch(
        `/api/notifications/${onlineNotifId}`,
        { data: { read: true } },
      );
      expect(crossPatch.status()).toBe(404);

      // Temporarily disable chatEnabled and verify personal notification channel still issues user:{id}
      await prisma.systemSetting.upsert({
        where: { key: "chatEnabled" },
        update: { value: "false" },
        create: { key: "chatEnabled", value: "false" },
      });
      const disabledChatTok = await pageOnline.request.get(
        "/api/chat/realtime/token",
      );
      expect(disabledChatTok.status()).toBe(200);
      const disabledTokJson = (await disabledChatTok.json()) as {
        channels?: string[];
      };
      expect(disabledTokJson.channels).toEqual([
        `user:${onlineUser.id}`,
        "events:public",
      ]);

      // Restore chatEnabled
      await prisma.systemSetting.upsert({
        where: { key: "chatEnabled" },
        update: { value: initialChatEnabled ? "true" : "false" },
        create: {
          key: "chatEnabled",
          value: initialChatEnabled ? "true" : "false",
        },
      });

      // 4. Offline user: admin approves booking while offlineUser has no active session
      const approveOfflineBtn = pageAdmin.locator(
        `[data-testid="approve-btn-${bookingOffline.id}"]`,
      );
      await expect(approveOfflineBtn).toBeVisible({ timeout: 15_000 });
      await approveOfflineBtn.click();
      await expect(
        pageAdmin.locator(`[data-testid="booking-status-${bookingOffline.id}"]`),
      ).toContainText(/CONFIRMED|مؤكد/i, { timeout: 20_000 });

      await ctxOffline.addInitScript(() => {
        try {
          window.localStorage.setItem("ihyaa-locale", "en");
        } catch {
          // ignore
        }
      });
      const pageOffline = await ctxOffline.newPage();
      await signInUser(pageOffline, offlineUser, "/profile");
      const summaryToast = pageOffline.locator("[data-sonner-toast]").first();
      await expect(summaryToast).toBeVisible({ timeout: 20_000 });
      await expect(summaryToast).toContainText("You have 1 new notification");

      // Reloading should NOT spam the summary toast again in the same browser session
      await pageOffline.reload({ waitUntil: "domcontentloaded" });
      await pageOffline.waitForTimeout(2000);
      await expect(pageOffline.locator("[data-sonner-toast]")).toHaveCount(0);

      // 5. /notifications inbox: click marks read & navigates to target (/profile#bookings)
      await pageOffline.goto("/notifications", { waitUntil: "load" });
      const inboxItem = pageOffline
        .locator('[data-testid^="notification-item-"]')
        .first();
      await expect(inboxItem).toBeVisible({ timeout: 15_000 });
      await expect(inboxItem).toContainText("Notification Test Camp");

      await inboxItem.click();
      await pageOffline.waitForURL(/\/profile#bookings/, {
        timeout: 15_000,
      });

      // Confirm notification is now marked read
      const afterClickList = await pageOffline.request.get(
        "/api/notifications?limit=10",
      );
      const afterClickJson = (await afterClickList.json()) as {
        unreadCount: number;
      };
      expect(afterClickJson.unreadCount).toBe(0);

      // Verify onlineUser can mark all as read in /notifications
      await pageOnline.goto("/notifications", { waitUntil: "load" });
      const markAllBtn = pageOnline.locator(
        '[data-testid="notifications-mark-all-btn"]',
      );
      await expect(markAllBtn).toBeVisible({ timeout: 15_000 });
      await markAllBtn.click();
      await expect(
        pageOnline.locator('[data-testid="navbar-avatar-unread-badge"]'),
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await prisma.systemSetting
        .upsert({
          where: { key: "chatEnabled" },
          update: { value: initialChatEnabled ? "true" : "false" },
          create: {
            key: "chatEnabled",
            value: initialChatEnabled ? "true" : "false",
          },
        })
        .catch(() => {});
      await ctxOnline.close().catch(() => {});
      await ctxAdmin.close().catch(() => {});
      await ctxOffline.close().catch(() => {});
      await prisma.notification
        .deleteMany({
          where: { userId: { in: [admin.id, onlineUser.id, offlineUser.id] } },
        })
        .catch(() => {});
      await prisma.booking
        .deleteMany({ where: { eventId: event.id } })
        .catch(() => {});
      await prisma.event
        .delete({ where: { id: event.id } })
        .catch(() => {});
      await prisma.session
        .deleteMany({
          where: { userId: { in: [admin.id, onlineUser.id, offlineUser.id] } },
        })
        .catch(() => {});
      await prisma.user
        .deleteMany({
          where: { id: { in: [admin.id, onlineUser.id, offlineUser.id] } },
        })
        .catch(() => {});
    }
  });
});
