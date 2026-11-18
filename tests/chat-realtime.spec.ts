import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { canonicalPairKey } from "../src/lib/chat/friends";

const prisma = new PrismaClient();

const createdUserIds: string[] = [];
const createdConvIds: string[] = [];
const createdEventIds: string[] = [];

function randomPassword(): string {
  return `T3-${randomBytes(12).toString("base64url")}!`;
}

async function createUser(prefix: string, role: Role = Role.USER) {
  const token = `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: `RTUser ${token}`,
      email: `${token.toLowerCase()}@example.test`,
      passwordHash,
      locale: "en",
      city: "Rabat",
      age: 24,
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: new Date(),
      chatTermsAcceptedAt: new Date(),
      sessionVersion: 1,
      role,
    },
  });
  createdUserIds.push(user.id);
  return { ...user, password };
}

async function loginContext(
  browser: Browser,
  user: { email: string | null; password: string },
  opts: { locale?: "ar" | "en"; viewport?: { width: number; height: number } } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 800 },
  });
  await context.addInitScript(
    ({ loc }) => {
      try {
        window.localStorage.setItem("ihyaa-locale", loc);
      } catch {}
    },
    { loc: opts.locale ?? "en" },
  );
  const page = await context.newPage();
  await page.goto("/login?callbackUrl=/profile", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-testid="login-email-input"]').fill(user.email!);
  await page.locator('[data-testid="login-password-input"]').fill(user.password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForURL((url) => url.pathname === "/profile", { timeout: 35_000 });
  return { context, page };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

test.describe("15-T3: Live Sockets, Blind E2EE Push, Delivery/Seen, Invites, Bookings & Reconnect", () => {
  test.describe.configure({ timeout: 240_000 });

  test.afterAll(async () => {
    try {
      if (createdConvIds.length > 0) {
        await prisma.conversation.deleteMany({ where: { id: { in: createdConvIds } } });
      }
      if (createdEventIds.length > 0) {
        await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.booking.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.friendship.deleteMany({
          where: {
            OR: [
              { requesterId: { in: createdUserIds } },
              { addresseeId: { in: createdUserIds } },
            ],
          },
        });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("delivers encrypted wire messages fast, transitions delivered->seen, flips invite cards, updates bookings/notifications live, and reconciles on reconnect", async ({
    browser,
  }) => {
    assertDevBranchDatabase("15-T3 live chat & realtime sync E2E");

    const priorSetting = await prisma.systemSetting.findUnique({ where: { key: "chatEnabled" } });
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "true" },
      create: { key: "chatEnabled", value: "true" },
    });

    const [userA, userB, adminUser] = await Promise.all([
      createUser("LiveA"),
      createUser("LiveB"),
      createUser("LiveAdmin", Role.ADMIN),
    ]);

    const pair = canonicalPairKey(userA.id, userB.id);
    await prisma.friendship.create({
      data: {
        pairKey: pair,
        requesterId: userA.id,
        addresseeId: userB.id,
        status: "ACCEPTED",
        respondedAt: new Date(),
      },
    });

    const dmConv = await prisma.conversation.create({
      data: {
        type: "DM",
        dmPairKey: pair,
        members: {
          create: [{ userId: userA.id }, { userId: userB.id }],
        },
      },
      select: { id: true },
    });
    createdConvIds.push(dmConv.id);

    const slug = `t3-live-${Date.now()}`;
    const event = await prisma.event.create({
      data: {
        slug,
        titleEn: "T3 Live Sync Camp",
        titleAr: "مخيم المزامنة المباشرة",
        descriptionEn: "Live booking sync test event",
        descriptionAr: "فعالية اختبار المزامنة المباشرة",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        time: "10:00",
        location: "Rabat",
        posterUrl: "/images/event-poster-1.jpg",
        capacityType: "LIMITED",
        capacity: 10,
        bookingOpen: true,
      },
      select: { id: true, titleEn: true },
    });
    createdEventIds.push(event.id);

    const booking = await prisma.booking.create({
      data: {
        userId: userB.id,
        eventId: event.id,
        fullName: userB.name ?? "Live UserB",
        email: userB.email!,
        city: "Rabat",
        age: 24,
        status: "PENDING",
        confirmed: false,
      },
      select: { id: true },
    });

    const sessA = await loginContext(browser, userA);
    const sessB = await loginContext(browser, userB);
    const sessAdmin = await loginContext(browser, adminUser);

    const pageA = sessA.page;
    const pageB = sessB.page;
    const pageAdmin = sessAdmin.page;
    const pageErrors: string[] = [];
    for (const p of [pageA, pageB, pageAdmin]) {
      p.on("pageerror", (e) => {
        console.log("[15-T3 pageerror]", e.message, e.stack);
        pageErrors.push(e.message);
      });
    }

    try {
      // 1. User B stays on /profile; User A opens DM -> sends message -> B gets grouped toast, title badge & delivery ack -> A sees "delivered"
      await pageA.goto("/messages", { waitUntil: "domcontentloaded" });
      await pageA.locator('[data-testid="chat-tab-friends"]').click();
      await expect(pageA.locator(`[data-testid="open-dm-${userB.id}"]`)).toBeVisible({
        timeout: 20_000,
      });
      await pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click();
      await expect(pageA.locator('[data-testid="chat-composer-input"]')).toBeVisible({
        timeout: 15_000,
      });

      // Wait briefly so B's NotificationRealtimeBridge SSE stream on /profile is connected
      await pageB.waitForTimeout(1500);

      const firstText = `T3 ping while B on profile ${Date.now()}`;
      await pageA.locator('[data-testid="chat-composer-input"]').fill(firstText);
      const [postFirst] = await Promise.all([
        pageA.waitForResponse(
          (r) =>
            r.url().includes("/api/chat/messages") &&
            r.request().method() === "POST" &&
            r.status() === 201,
          { timeout: 15_000 },
        ),
        pageA.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      const firstPayload = (await postFirst.json()) as { message: { id: string } };

      // B on /profile gets grouped toast + title count
      await expect(pageB.locator("[data-sonner-toast]").first()).toContainText(firstText, {
        timeout: 10_000,
      });
      await expect
        .poll(async () => pageB.title(), { timeout: 10_000 })
        .toMatch(/^\(\d+\)\s/);

      // A's sent message transitions to "delivered" while B has NOT opened /messages
      const firstReceipt = pageA.locator(`[data-testid="msg-receipt-${firstPayload.message.id}"]`);
      await expect(firstReceipt).toHaveAttribute("data-delivery-state", "delivered", {
        timeout: 10_000,
      });

      // 2. Live booking status + notification on B's /profile when Admin approves booking
      const bookingCardB = pageB.locator(`[data-testid="profile-booking-item-${booking.id}"]`);
      await expect(bookingCardB).toContainText(/Pending|قيد الانتظار/i, { timeout: 10_000 });

      await pageAdmin.goto("/admin/bookings", { waitUntil: "domcontentloaded" });
      const approveBtn = pageAdmin.locator(`[data-testid="approve-btn-${booking.id}"]`);
      await expect(approveBtn).toBeVisible({ timeout: 20_000 });
      await Promise.all([
        pageAdmin.waitForResponse(
          (r) => r.url().includes("/admin/bookings") && r.request().method() === "POST",
          { timeout: 25_000 },
        ),
        approveBtn.click(),
      ]);

      // B's /profile booking card updates live to Confirmed without reload
      await expect(bookingCardB).toContainText(/Confirmed|مؤكد/i, { timeout: 15_000 });

      // 3. B opens /messages and opens DM -> A's receipt transitions from delivered -> seen, and typing indicator works live
      await pageB.goto("/messages", { waitUntil: "domcontentloaded" });
      await pageB.locator('[data-testid="chat-tab-friends"]').click();
      await expect(pageB.locator(`[data-testid="open-dm-${userA.id}"]`)).toBeVisible({
        timeout: 20_000,
      });
      await pageB.locator(`[data-testid="open-dm-${userA.id}"]`).click();
      await expect(
        pageB.locator('[data-testid="chat-messages-scroll"]').getByText(firstText),
      ).toBeVisible({ timeout: 15_000 });

      await expect(firstReceipt).toHaveAttribute("data-delivery-state", "seen", {
        timeout: 10_000,
      });

      // Typing indicator
      await Promise.all([
        pageA.waitForResponse(
          (r) => r.url().includes("/api/chat/realtime/typing") && r.status() === 200,
          { timeout: 10_000 },
        ),
        pageA.locator('[data-testid="chat-composer-input"]').type("Typing..."),
      ]);
      await expect(pageB.locator('[data-testid="chat-typing-indicator"]')).toBeVisible({
        timeout: 8_000,
      });
      await pageA.locator('[data-testid="chat-composer-input"]').fill("");

      // 4. Measure local-transport blind E2EE delivery latency across 10 alternating messages (2 warmup + 10 measured)
      const postSaveRenderLatencies: number[] = [];
      const fullClickRenderLatencies: number[] = [];
      for (let i = 0; i < 12; i++) {
        const senderPage = i % 2 === 0 ? pageA : pageB;
        const receiverPage = i % 2 === 0 ? pageB : pageA;
        const body = `T3-lat-${i}-${randomBytes(3).toString("hex")}`;
        await senderPage.locator('[data-testid="chat-composer-input"]').fill(body);
        const tClick = performance.now();
        const postPromise = senderPage.waitForResponse(
          (r) =>
            r.url().includes("/api/chat/messages") &&
            r.request().method() === "POST" &&
            r.status() === 201,
          { timeout: 15_000 },
        );
        await senderPage.locator('[data-testid="chat-send-btn"]').click();
        await postPromise;
        const t201 = performance.now();
        await receiverPage.waitForFunction(
          (text) =>
            document
              .querySelector('[data-testid="chat-messages-scroll"]')
              ?.textContent?.includes(text) ?? false,
          body,
          { polling: "raf", timeout: 10_000 },
        );
        const tRender = performance.now();
        if (i >= 2) {
          postSaveRenderLatencies.push(tRender - t201);
          fullClickRenderLatencies.push(tRender - tClick);
        }
      }
      const sortedLat = [...postSaveRenderLatencies].sort((a, b) => a - b);
      const sortedFull = [...fullClickRenderLatencies].sort((a, b) => a - b);
      const p50 = percentile(sortedLat, 50);
      const p95 = percentile(sortedLat, 95);
      console.log(
        `[15-T3] post-commit wire E2EE render latency (n=${sortedLat.length}): p50=${p50.toFixed(1)}ms, p95=${p95.toFixed(1)}ms, max=${sortedLat[sortedLat.length - 1].toFixed(1)}ms | full click->render: p50=${percentile(sortedFull, 50).toFixed(1)}ms, p95=${percentile(sortedFull, 95).toFixed(1)}ms`,
      );
      expect(p50).toBeLessThan(150);
      expect(p95).toBeLessThan(400);

      // 5. Room invite card flips live on sender's DM when recipient accepts
      console.log("[15-T3] step 5: creating room + invite");
      await pageA.locator('[data-testid="chat-new-room-btn"]').click();
      await pageA.locator('[data-testid="create-room-name-input"]').fill("Live Flip Room");
      const [roomRes] = await Promise.all([
        pageA.waitForResponse(
          (r) => r.url().endsWith("/api/chat/rooms") && r.request().method() === "POST",
          { timeout: 20_000 },
        ),
        pageA.locator('[data-testid="create-room-submit-btn"]').click(),
      ]);
      expect(roomRes.status()).toBe(201);
      const roomJson = (await roomRes.json()) as { room: { id: string } };
      createdConvIds.push(roomJson.room.id);

      await pageA.locator('[data-testid="chat-room-members-btn"]').click();
      await pageA.locator('[data-testid="room-invite-friend-select"]').click();
      await pageA.getByRole("option", { name: userB.name! }).click();
      const [inviteRes] = await Promise.all([
        pageA.waitForResponse(
          (r) => r.url().includes("/invites") && r.request().method() === "POST",
          { timeout: 20_000 },
        ),
        pageA.locator('[data-testid="room-send-dm-invite-btn"]').click(),
      ]);
      expect(inviteRes.status()).toBe(201);
      const inviteJson = (await inviteRes.json()) as { invite: { id: string } };

      await pageA.keyboard.press("Escape");
      await pageA.locator('[data-testid="chat-tab-friends"]').click();
      await pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click();

      const senderInviteCard = pageA.locator(`[data-testid="chat-invite-card-${inviteJson.invite.id}"]`);
      await expect(senderInviteCard).toContainText(/Pending|قيد الانتظار/i, { timeout: 15_000 });

      const acceptBtnB = pageB.locator(`[data-testid="invite-accept-${inviteJson.invite.id}"]`);
      await expect(acceptBtnB).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        pageB.waitForResponse(
          (r) => r.url().includes("/respond") && r.request().method() === "POST",
          { timeout: 20_000 },
        ),
        acceptBtnB.click(),
      ]);

      await expect(senderInviteCard).toContainText(/Accepted|مقبولة/i, { timeout: 10_000 });
      await expect(pageB.locator('[data-testid="chat-room-members-btn"]')).toBeVisible({
        timeout: 15_000,
      });

      // Accepting the invite switched B to the room; switch B back to the DM with A before testing offline backfill
      await pageB.locator('[data-testid="chat-tab-friends"]').click();
      await pageB.locator(`[data-testid="open-dm-${userA.id}"]`).click();
      await expect(
        pageB.locator(`[data-testid="chat-invite-card-${inviteJson.invite.id}"]`),
      ).toContainText(/Accepted|مقبولة/i, { timeout: 10_000 });

      // 6. Reconnect backfill: disconnect B offline, A sends a message, restore B online -> B reconciles & displays missed message
      await sessB.context.setOffline(true);
      const missedBody = `T3-missed-offline-${Date.now()}`;
      await pageA.locator('[data-testid="chat-composer-input"]').fill(missedBody);
      await Promise.all([
        pageA.waitForResponse(
          (r) =>
            r.url().includes("/api/chat/messages") &&
            r.request().method() === "POST" &&
            r.status() === 201,
          { timeout: 15_000 },
        ),
        pageA.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      await sessB.context.setOffline(false);
      // Trigger visibility/online reconciliation or reconnect backoff
      await pageB.evaluate(() => {
        window.dispatchEvent(new Event("online"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(
        pageB.locator('[data-testid="chat-messages-scroll"]').getByText(missedBody),
      ).toBeVisible({ timeout: 15_000 });

      expect(pageErrors).toEqual([]);
    } finally {
      if (priorSetting) {
        await prisma.systemSetting.upsert({
          where: { key: "chatEnabled" },
          update: { value: priorSetting.value },
          create: { key: "chatEnabled", value: priorSetting.value },
        });
      } else {
        await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
      }
      await sessA.context.close().catch(() => {});
      await sessB.context.close().catch(() => {});
      await sessAdmin.context.close().catch(() => {});
    }
  });
});
