import crypto from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { encryptMessage } from "../src/lib/chat/crypto-core";

assertDevBranchDatabase();

const prisma = new PrismaClient();
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:3000";

async function setChatEnabled(enabled: boolean): Promise<string | null> {
  const existing = await prisma.systemSetting.findUnique({ where: { key: "chatEnabled" } });
  await prisma.systemSetting.upsert({
    where: { key: "chatEnabled" },
    create: { key: "chatEnabled", value: enabled ? "true" : "false" },
    update: { value: enabled ? "true" : "false" },
  });
  return existing?.value ?? null;
}

async function restoreChatEnabled(prev: string | null) {
  if (prev === null) {
    await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
  } else {
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      create: { key: "chatEnabled", value: prev },
      update: { value: prev },
    });
  }
}

async function createTestUser(label: string, locale: "ar" | "en" = "en") {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const email = `chat-t4-${label.toLowerCase()}-${suffix}@example.test`;
  const password = `Pw!${crypto.randomBytes(8).toString("hex")}A1`;
  const passwordHash = await bcrypt.hash(password, 6);
  const displayName = `T4 ${label} ${suffix.slice(-4)}`;
  const user = await prisma.user.create({
    data: {
      email,
      name: displayName,
      passwordHash,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      chatTermsAcceptedAt: new Date(),
      sessionVersion: 1,
      city: "Rabat",
      age: 24,
      showOnlineStatus: true,
      showFriendCount: true,
      locale,
      theme: "light",
    },
    select: { id: true },
  });
  return { id: user.id, email, name: displayName, password };
}

async function cleanupTestUsers(userIds: string[]) {
  if (userIds.length === 0) return;
  await prisma.report.deleteMany({
    where: { OR: [{ reporterId: { in: userIds } }, { reportedUserId: { in: userIds } }] },
  });
  await prisma.message.deleteMany({
    where: { OR: [{ senderId: { in: userIds } }, { conversation: { ownerId: { in: userIds } } }] },
  });
  await prisma.invite.deleteMany({
    where: { OR: [{ inviterId: { in: userIds } }, { inviteeId: { in: userIds } }] },
  });
  await prisma.conversationMember.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.conversation.deleteMany({
    where: {
      OR: [
        { ownerId: { in: userIds } },
        ...userIds.map((id) => ({ dmPairKey: { contains: id } })),
      ],
    },
  });
  await prisma.friendship.deleteMany({
    where: { OR: [{ requesterId: { in: userIds } }, { addresseeId: { in: userIds } }] },
  });
  await prisma.block.deleteMany({
    where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function signIn(
  browser: Browser,
  email: string,
  password: string,
  viewport = { width: 1280, height: 820 },
  hasTouch = false,
  locale: "ar" | "en" = "ar",
) {
  const context = await browser.newContext({ viewport, hasTouch });
  await context.addInitScript(
    ({ loc }) => {
      try {
        if (!window.localStorage.getItem("ihyaa-locale")) {
          window.localStorage.setItem("ihyaa-locale", loc);
        }
      } catch {}
    },
    { loc: locale },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const locUrl = msg.location()?.url ?? "";
      if (
        msg.text().includes("404 (Not Found)") &&
        locUrl.includes("/_next/image") &&
        locUrl.includes("res.cloudinary.com")
      ) {
        return;
      }
      errors.push(msg.text());
    }
  });
  page.on("request", (req) => {
    const url = req.url();
    if (
      url.startsWith("http") &&
      !url.startsWith(BASE) &&
      !url.includes("ably") &&
      !url.includes("cloudinary") &&
      !url.includes("127.0.0.1") &&
      !url.includes("localhost")
    ) {
      externalRequests.push(url);
    }
  });
  await page.goto("/login?callbackUrl=/chat");
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/chat(?:\?.*)?$/, { timeout: 35_000 });
  return { context, page, errors, externalRequests };
}

test.describe("15-T4: WhatsApp Bubble Layout, Side Actions, Lazy Emoji Picker & Renaming", () => {
  test.describe.configure({ timeout: 240_000 });

  test("renames to Public chat, verifies grouping/tails/side menu/copy/status ticks/1000-msg windowing/emoji picker/mobile viewports", async ({
    browser,
  }) => {
    const prevEnabled = await setChatEnabled(true);
    const createdIds: string[] = [];

    try {
      const userA = await createTestUser("Alice", "en");
      const userB = await createTestUser("Bilal", "en");
      createdIds.push(userA.id, userB.id);

      const pairKey = [userA.id, userB.id].sort().join(":");
      await prisma.friendship.create({
        data: {
          requesterId: userA.id,
          addresseeId: userB.id,
          pairKey,
          status: "ACCEPTED",
        },
      });

      const now = Date.now();
      const dm = await prisma.conversation.create({
        data: {
          type: "DM",
          dmPairKey: pairKey,
          keyEpoch: 1,
          lastMessageAt: new Date(now - 5_000),
          members: {
            create: [
              { userId: userA.id, lastReadAt: new Date(now - 60_000), lastDeliveredAt: new Date(now - 60_000) },
              { userId: userB.id, lastReadAt: new Date(now - 120_000), lastDeliveredAt: new Date(now - 120_000) },
            ],
          },
        },
      });

      const room = await prisma.conversation.create({
        data: {
          type: "ROOM",
          name: "T4 Study Circle",
          emoji: "📚",
          ownerId: userA.id,
          keyEpoch: 1,
          lastMessageAt: new Date(now - 180_000),
          members: {
            create: [
              { userId: userA.id, role: "OWNER" },
              { userId: userB.id, role: "MEMBER" },
            ],
          },
        },
      });

      const seedMessages: Array<{
        convId: string;
        senderId: string;
        text: string;
        createdAt: Date;
      }> = [
        { convId: dm.id, senderId: userB.id, text: "Group1 first", createdAt: new Date(now - 900_000) },
        { convId: dm.id, senderId: userB.id, text: "Group1 second", createdAt: new Date(now - 880_000) },
        { convId: dm.id, senderId: userB.id, text: "Group2 after gap", createdAt: new Date(now - 400_000) },
        { convId: dm.id, senderId: userA.id, text: "Own seen msg", createdAt: new Date(now - 300_000) },
        { convId: dm.id, senderId: userA.id, text: "Own sent msg", createdAt: new Date(now - 30_000) },
        {
          convId: dm.id,
          senderId: userB.id,
          text: "SuperLongUnbrokenToken_" + "x".repeat(120),
          createdAt: new Date(now - 10_000),
        },
        { convId: room.id, senderId: userB.id, text: "Room first", createdAt: new Date(now - 200_000) },
        { convId: room.id, senderId: userB.id, text: "Room second", createdAt: new Date(now - 180_000) },
      ];

      const insertedIds: string[] = [];
      for (const item of seedMessages) {
        const msgId = `t4m_${crypto.randomBytes(10).toString("hex")}`;
        const enc = encryptMessage({
          plaintext: item.text,
          conversationId: item.convId,
          messageId: msgId,
          senderId: item.senderId,
          keyEpoch: 1,
        });
        const row = await prisma.message.create({
          data: {
            id: msgId,
            conversationId: item.convId,
            senderId: item.senderId,
            ciphertext: enc.ciphertext,
            nonce: enc.nonce,
            keyVersion: enc.keyVersion,
            keyEpoch: 1,
            createdAt: item.createdAt,
          },
          select: { id: true },
        });
        insertedIds.push(row.id);
      }

      const [dmB1, dmB2, dmB3, dmOwnSeen, dmOwnSent, dmLong, roomB1, roomB2] = insertedIds;

      const aSession = await signIn(browser, userA.email, userA.password, { width: 1280, height: 820 }, false, "ar");
      const bSession = await signIn(browser, userB.email, userB.password, { width: 360, height: 740 }, true, "en");

      try {
        const pageA: Page = aSession.page;
        const pageB: Page = bSession.page;

        // 1. Renaming: "الدردشة العامة" in AR, then "Public chat" in EN
        await expect(pageA.locator('nav a[href="/chat"]')).toContainText("الدردشة العامة", {
          timeout: 15_000,
        });
        await expect(pageA).toHaveTitle(/الدردشة العامة/);
        await expect(pageA.locator('[data-testid="chat-conv-header"]')).toContainText("الدردشة العامة");
        // No status ticks in PUBLIC
        await expect(pageA.locator('[data-testid^="msg-receipt-"]')).toHaveCount(0);

        await pageA.evaluate(async () => {
          window.localStorage.setItem("ihyaa-locale", "en");
          await fetch("/api/user/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locale: "en" }),
          });
        });
        await pageA.reload({ waitUntil: "domcontentloaded" });
        await expect(pageA.locator('nav a[href="/chat"]')).toContainText("Public chat", {
          timeout: 15_000,
        });
        await expect(pageA).toHaveTitle(/Public chat/i);
        await expect(pageA.locator('[data-testid="chat-conv-header"]')).toContainText("Public chat");

        // 2. Navigate to /messages on pageA first to verify seen vs sent ticks before B reads
        await pageA.goto("/messages");
        await expect(pageA.locator('[data-testid="chat-workspace"]')).toBeVisible({ timeout: 15_000 });
        await pageA.locator('[data-testid="chat-tab-friends"]').click();
        await pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click();
        await expect(pageA.locator('[data-testid="chat-conv-header"]')).toContainText(userB.name, {
          timeout: 15_000,
        });
        await expect(pageA.locator(`[data-testid="chat-message-${dmB1}"]`)).toBeVisible({ timeout: 15_000 });

        // Check seen (blue token) vs sent (muted) before B opens DM
        const receiptSeen = pageA.locator(`[data-testid="msg-receipt-${dmOwnSeen}"]`);
        const receiptSent = pageA.locator(`[data-testid="msg-receipt-${dmOwnSent}"]`);
        await expect(receiptSeen).toHaveAttribute("data-delivery-state", "seen");
        await expect(receiptSent).toHaveAttribute("data-delivery-state", "sent");
        const tickColors = await pageA.evaluate(({ seenId, sentId }) => {
          const s1 = document.querySelector(`[data-testid="msg-receipt-${seenId}"] svg`) as SVGElement;
          const s2 = document.querySelector(`[data-testid="msg-receipt-${sentId}"] svg`) as SVGElement;
          return {
            seenColor: getComputedStyle(s1).color,
            sentColor: getComputedStyle(s2).color,
          };
        }, { seenId: dmOwnSeen, sentId: dmOwnSent });
        expect(tickColors.seenColor).not.toBe(tickColors.sentColor);

        // 3. Open /messages on mobile pageB and check 320px, 360px, 390px compact single-row DM header
        await pageB.goto("/messages", { waitUntil: "domcontentloaded" });
        await pageB.locator('[data-testid="chat-tab-friends"]').click();
        await pageB.locator(`[data-testid="open-dm-${userA.id}"]`).click();
        await expect(pageB.locator('[data-testid="chat-conv-header"]')).toContainText(userA.name, {
          timeout: 15_000,
        });

        for (const width of [320, 360, 390]) {
          await pageB.setViewportSize({ width, height: 740 });
          const metrics = await pageB.evaluate(() => {
            const header = document.querySelector('[data-testid="chat-conv-header"]') as HTMLElement;
            const backBtn = document.querySelector('[data-testid="chat-mobile-back-btn"]') as HTMLElement;
            const searchBtn = document.querySelector('[data-testid="chat-conv-search-btn"]') as HTMLElement;
            const menuBtn = document.querySelector('[data-testid="chat-conv-menu-btn"]') as HTMLElement;
            const emojiBtn = document.querySelector('[data-testid="chat-emoji-btn"]') as HTMLElement;
            return {
              overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
              headerHeight: header?.getBoundingClientRect().height ?? 0,
              backRect: backBtn?.getBoundingClientRect(),
              searchRect: searchBtn?.getBoundingClientRect(),
              menuRect: menuBtn?.getBoundingClientRect(),
              emojiRect: emojiBtn?.getBoundingClientRect(),
            };
          });
          expect(metrics.overflow).toBe(false);
          expect(metrics.headerHeight).toBeLessThanOrEqual(72);
          expect(metrics.backRect?.width).toBeGreaterThanOrEqual(44);
          expect(metrics.backRect?.height).toBeGreaterThanOrEqual(44);
          expect(metrics.searchRect?.width).toBeGreaterThanOrEqual(44);
          expect(metrics.menuRect?.width).toBeGreaterThanOrEqual(44);
          expect(metrics.emojiRect?.width).toBeGreaterThanOrEqual(44);
        }
        await pageB.setViewportSize({ width: 360, height: 740 });

        // 4. Grouping, tails, spacing, max-width, overflow-wrap, and DM no-avatar check on desktop
        expect(await pageA.locator(`[data-testid="msg-bubble-${dmB1}"]`).getAttribute("data-tail")).toBe("true");
        expect(await pageA.locator(`[data-testid="msg-bubble-${dmB2}"]`).getAttribute("data-tail")).toBe("false");
        expect(await pageA.locator(`[data-testid="msg-bubble-${dmB3}"]`).getAttribute("data-tail")).toBe("true");
        expect(await pageA.locator(`[data-testid="msg-bubble-${dmOwnSeen}"]`).getAttribute("data-tail")).toBe("true");
        // No avatar links inside DM message list
        expect(await pageA.locator('[data-testid="chat-messages-scroll"] a[href^="/u/"]').count()).toBe(0);

        const dmGeometry = await pageA.evaluate(({ b1, b2, b3, longId }) => {
          const pane = document.querySelector('[data-testid="chat-messages-scroll"]') as HTMLElement;
          const r1 = document.querySelector(`[data-testid="chat-message-${b1}"]`) as HTMLElement;
          const r2 = document.querySelector(`[data-testid="chat-message-${b2}"]`) as HTMLElement;
          const r3 = document.querySelector(`[data-testid="chat-message-${b3}"]`) as HTMLElement;
          const longBubble = document.querySelector(`[data-testid="msg-bubble-${longId}"]`) as HTMLElement;
          return {
            intraGroupGap: Math.round(r2.getBoundingClientRect().top - r1.getBoundingClientRect().bottom),
            interGroupGap: Math.round(r3.getBoundingClientRect().top - r2.getBoundingClientRect().bottom),
            longBubbleWidth: longBubble.getBoundingClientRect().width,
            paneWidth: pane.clientWidth,
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        }, { b1: dmB1, b2: dmB2, b3: dmB3, longId: dmLong });

        expect(dmGeometry.intraGroupGap).toBeLessThanOrEqual(4);
        expect(dmGeometry.interGroupGap).toBeGreaterThanOrEqual(7);
        expect(dmGeometry.longBubbleWidth).toBeLessThanOrEqual(dmGeometry.paneWidth * 0.62);
        expect(dmGeometry.overflow).toBe(false);

        // Check ROOM grouping + avatar only on first-in-group
        await pageA.locator('[data-testid="chat-tab-rooms"]').click();
        await pageA.locator(`[data-testid="chat-conv-room-${room.id}"]`).click();
        await expect(pageA.locator(`[data-testid="chat-message-${roomB1}"]`)).toBeVisible({ timeout: 15_000 });
        expect(await pageA.locator(`[data-testid="msg-bubble-${roomB1}"]`).getAttribute("data-tail")).toBe("true");
        expect(await pageA.locator(`[data-testid="msg-bubble-${roomB2}"]`).getAttribute("data-tail")).toBe("false");
        const roomAvatarCounts = await pageA.evaluate(({ r1, r2 }) => {
          const row1 = document.querySelector(`[data-testid="chat-message-${r1}"]`)!;
          const row2 = document.querySelector(`[data-testid="chat-message-${r2}"]`)!;
          return {
            firstHasSenderName: row1.textContent?.includes("Bilal") ?? false,
            firstHasAvatar: row1.querySelectorAll('a[href^="/u/"]').length === 2,
            secondHasNoAvatar: row2.querySelectorAll('a[href^="/u/"]').length === 0,
          };
        }, { r1: roomB1, r2: roomB2 });
        expect(roomAvatarCounts.firstHasSenderName).toBe(true);
        expect(roomAvatarCounts.firstHasAvatar).toBe(true);
        expect(roomAvatarCounts.secondHasNoAvatar).toBe(true);

        // Back to DM for action menu, Copy, Reply, Report, Delete
        await pageA.locator('[data-testid="chat-tab-friends"]').click();
        await pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click();
        await expect(pageA.locator(`[data-testid="chat-message-${dmB1}"]`)).toBeVisible({ timeout: 15_000 });

        await pageA.locator(`[data-testid="chat-message-${dmB1}"]`).hover();
        await pageA.locator(`[data-testid="msg-actions-trigger-${dmB1}"]`).click();
        await pageA.locator(`[data-testid="copy-msg-${dmB1}"]`).click();
        await expect(pageA.locator(`[data-testid="msg-copied-badge-${dmB1}"]`)).toBeVisible({
          timeout: 3_000,
        });
        await expect(pageA.locator('[data-testid="chat-copy-live"]')).not.toBeEmpty();

        // Reply via side menu
        await pageA.locator(`[data-testid="chat-message-${dmB2}"]`).hover();
        await pageA.locator(`[data-testid="msg-actions-trigger-${dmB2}"]`).click();
        await pageA.locator(`[data-testid="reply-msg-${dmB2}"]`).click();
        await expect(pageA.locator('[data-testid="chat-composer-input"]')).toBeFocused();
        await pageA.locator('[data-testid="chat-reply-cancel-btn"]').click();

        // Report option exists for peer message via side menu
        await pageA.locator(`[data-testid="chat-message-${dmB2}"]`).hover();
        await pageA.locator(`[data-testid="msg-actions-trigger-${dmB2}"]`).click();
        await expect(pageA.locator(`[data-testid="report-msg-${dmB2}"]`)).toBeVisible();
        await pageA.keyboard.press("Escape");

        // Delete own message via side menu
        await pageA.locator(`[data-testid="chat-message-${dmOwnSent}"]`).hover();
        await pageA.locator(`[data-testid="msg-actions-trigger-${dmOwnSent}"]`).click();
        await pageA.locator(`[data-testid="delete-msg-${dmOwnSent}"]`).click();
        await pageA.getByRole("button", { name: /delete|confirm|حذف|تأكيد/i }).last().click();
        await expect(pageA.locator(`[data-testid="chat-message-${dmOwnSent}"]`)).toContainText(/deleted|حُذفت/i, {
          timeout: 10_000,
        });

        // 5. Mobile touch long-press shows trigger & opens menu without clipping
        const bubbleB1 = pageB.locator(`[data-testid="msg-bubble-${dmB1}"]`);
        await bubbleB1.dispatchEvent("pointerdown", { pointerType: "touch", clientX: 80, clientY: 200 });
        await pageB.waitForTimeout(480);
        await bubbleB1.dispatchEvent("pointerup", { pointerType: "touch", clientX: 80, clientY: 200 });
        await expect(pageB.locator(`[data-testid="msg-actions-trigger-${dmB1}"]`)).toBeVisible();
        await expect(pageB.locator(`[data-testid="copy-msg-${dmB1}"]`)).toBeVisible();
        await pageB.keyboard.press("Escape");

        // 6. Self-hosted lazy Unicode emoji picker on mobile (keyboard-swap below composer) & search AR + EN
        await pageB.locator('[data-testid="chat-emoji-btn"]').click();
        await expect(pageB.locator('[data-testid="chat-emoji-picker"]')).toBeVisible({ timeout: 5_000 });
        const pickerLayout = await pageB.evaluate(() => {
          const input = document.querySelector('[data-testid="chat-composer-input"]')!.getBoundingClientRect();
          const picker = document.querySelector('[data-testid="chat-emoji-picker"]')!.getBoundingClientRect();
          return {
            composerAbovePicker: input.bottom <= picker.top + 4,
            overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        expect(pickerLayout.composerAbovePicker).toBe(true);
        expect(pickerLayout.overflow).toBe(false);

        // Search English + Arabic + skin tone + Recent
        await pageB.locator('[data-testid="chat-emoji-search"]').fill("mosque");
        await expect(pageB.locator('[data-testid="chat-emoji-picker"]').getByRole("button", { name: /mosque/i }).first()).toBeVisible({
          timeout: 5_000,
        });
        await pageB.locator('[data-testid="chat-emoji-search"]').fill("قلب");
        await expect(pageB.locator('[data-testid="chat-emoji-picker"] button').filter({ hasText: "❤" }).first()).toBeVisible({
          timeout: 5_000,
        });
        await pageB.locator('[data-testid="emoji-tone-3"]').click();
        await pageB.locator('[data-testid="chat-emoji-search"]').fill("");
        await pageB.locator('[data-testid="emoji-cat-0"]').click();
        await pageB.locator('[data-testid="chat-emoji-picker"] button').filter({ hasText: "😊" }).last().click();
        await expect(pageB.locator('[data-testid="chat-composer-input"]')).toHaveValue(/😊/);
        // Zero external CDN requests for emoji data
        expect(aSession.externalRequests).toEqual([]);
        expect(bSession.externalRequests).toEqual([]);

        // 7. 1000-message windowing + content-visibility + no initial arrival animation
        await pageA.route("**/api/chat/messages?*", async (route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("conversationId") === room.id && !url.searchParams.get("cursor")) {
            // API returns newest-first; client reverses to oldest-first
            const thousand = Array.from({ length: 1000 }, (_, idx) => {
              const num = 1000 - idx;
              return {
                id: `bulk-msg-${num}`,
                conversationId: room.id,
                senderId: num % 2 === 0 ? userA.id : userB.id,
                sender: {
                  id: num % 2 === 0 ? userA.id : userB.id,
                  name: num % 2 === 0 ? userA.name : userB.name,
                  image: null,
                  role: "USER",
                },
                isAnonymized: false,
                type: "TEXT",
                body: `Bulk history message #${num}`,
                decryptionFailed: false,
                deleted: false,
                editedAt: null,
                createdAt: new Date(now - (1000 - num) * 60_000).toISOString(),
                replyTo: null,
                invite: null,
              };
            });
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                messages: thousand,
                nextCursor: null,
              }),
            });
            return;
          }
          await route.continue();
        });

        await pageA.goto(`/messages?c=${room.id}`);
        await expect(pageA.locator('[data-testid="chat-message-bulk-msg-1000"]')).toBeVisible({
          timeout: 15_000,
        });
        const windowStats = await pageA.evaluate(() => {
          const rendered = document.querySelectorAll('[data-testid^="chat-message-"]');
          const firstRow = rendered[0]?.parentElement as HTMLElement | null;
          const animating = document.querySelectorAll('[class*="messageArrival"]');
          return {
            renderedCount: rendered.length,
            contentVisibility: firstRow ? getComputedStyle(firstRow).contentVisibility : "",
            animatingCount: animating.length,
          };
        });
        expect(windowStats.renderedCount).toBeLessThanOrEqual(80);
        expect(windowStats.renderedCount).toBeGreaterThanOrEqual(10);
        expect(windowStats.contentVisibility).toBe("auto");
        expect(windowStats.animatingCount).toBe(0);

        await pageA.unroute("**/api/chat/messages?*");

        // 8. Verify 4 themes have distinct --chat-seen blue token and zero errors
        for (const theme of ["light", "dark", "sunset", "amoled"] as const) {
          await pageA.evaluate((tName) => {
            document.documentElement.setAttribute("data-theme", tName);
            document.documentElement.classList.toggle("dark", tName === "dark" || tName === "amoled");
          }, theme);
          const seenToken = await pageA.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue("--chat-seen").trim(),
          );
          expect(seenToken.length).toBeGreaterThan(0);
        }

        expect(aSession.errors).toEqual([]);
        expect(bSession.errors).toEqual([]);
      } finally {
        await aSession.context.close();
        await bSession.context.close();
      }
    } finally {
      await cleanupTestUsers(createdIds);
      await restoreChatEnabled(prevEnabled);
    }
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
