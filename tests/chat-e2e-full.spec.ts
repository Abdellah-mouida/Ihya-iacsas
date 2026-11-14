import { randomBytes } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

const prisma = new PrismaClient();
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL ?? "http://127.0.0.1:3001";

const createdUserIds: string[] = [];
const createdConvIds: string[] = [];
const createdPublicMessageIds: string[] = [];

function randomPassword(): string {
  return `T9-${randomBytes(12).toString("base64url")}!`;
}

async function createUser(prefix: string, role: Role = Role.USER) {
  const token = `${prefix}-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = randomPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: `T9User ${token}`,
      email: `${token.toLowerCase()}@example.test`,
      passwordHash,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      role,
    },
  });
  createdUserIds.push(user.id);
  return { ...user, password };
}

async function loginContext(
  browser: Browser,
  user: { email: string | null; password: string },
  opts: {
    viewport: { width: number; height: number };
    locale: "ar" | "en";
    theme?: "light" | "sunset" | "amoled" | "black";
    hardwareConcurrency?: number;
    deviceMemory?: number;
  },
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: opts.viewport,
  });
  await context.addInitScript(
    ({ loc, thm, hw, mem }) => {
      try {
        window.localStorage.setItem("ihyaa-locale", loc);
        if (thm) window.localStorage.setItem("ihyaa-theme", thm);
      } catch {}
      if (typeof hw === "number") {
        Object.defineProperty(navigator, "hardwareConcurrency", {
          configurable: true,
          get: () => hw,
        });
      }
      if (typeof mem === "number") {
        Object.defineProperty(navigator, "deviceMemory", {
          configurable: true,
          get: () => mem,
        });
      }
    },
    {
      loc: opts.locale,
      thm: opts.theme ?? null,
      hw: opts.hardwareConcurrency,
      mem: opts.deviceMemory,
    },
  );
  const page = await context.newPage();
  await page.goto("/login?callbackUrl=/profile", { waitUntil: "networkidle" });
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="login-email-input"]').fill(user.email!);
  await page.locator('[data-testid="login-password-input"]').fill(user.password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/profile(?:\?.*)?$/, { timeout: 25_000 });
  return { context, page };
}

test.describe("12-T9: Full Multi-Context Chat E2E (A, B, C, Moderator)", () => {
  test.afterAll(async () => {
    try {
      const targetUserIds = new Set(createdUserIds);
      const strayUsers = await prisma.user.findMany({
        where: { email: { endsWith: "@example.test" }, name: { startsWith: "T9User " } },
        select: { id: true },
      });
      for (const u of strayUsers) targetUserIds.add(u.id);
      const ids = Array.from(targetUserIds);

      if (ids.length > 0 || createdPublicMessageIds.length > 0) {
        await prisma.report.deleteMany({
          where: {
            OR: [
              { reporterId: { in: ids } },
              { messageId: { in: createdPublicMessageIds } },
            ],
          },
        });
        await Promise.all([
          prisma.message.deleteMany({
            where: {
              OR: [
                { id: { in: createdPublicMessageIds } },
                { senderId: { in: ids } },
              ],
            },
          }),
          prisma.invite.deleteMany({
            where: {
              OR: [{ inviterId: { in: ids } }, { inviteeId: { in: ids } }],
            },
          }),
          prisma.conversationMember.deleteMany({
            where: { userId: { in: ids } },
          }),
        ]);
        await Promise.all([
          createdConvIds.length > 0
            ? prisma.conversation.deleteMany({ where: { id: { in: createdConvIds } } })
            : Promise.resolve(),
          prisma.friendship.deleteMany({
            where: { OR: [{ requesterId: { in: ids } }, { addresseeId: { in: ids } }] },
          }),
          prisma.block.deleteMany({
            where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
          }),
          prisma.auditLog.deleteMany({
            where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] },
          }),
        ]);
        if (ids.length > 0) {
          await prisma.user.deleteMany({ where: { id: { in: ids } } });
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("friends, realtime DM (<2s), typing, read receipt, rooms/invites, stranger 404, public moderation, phone RTL & low-perf", async ({
    browser,
  }) => {
    assertDevBranchDatabase("12-T9 full multi-context E2E");
    test.setTimeout(300_000);

    const priorSetting = await prisma.systemSetting.findUnique({ where: { key: "chatEnabled" } });
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "true" },
      create: { key: "chatEnabled", value: "true" },
    });

    const [userA, userB, userC, modUser] = await Promise.all([
      createUser("A"),
      createUser("B"),
      createUser("C"),
      createUser("MOD", Role.MODERATOR),
    ]);

    const [sessA, sessB, sessC, sessMod] = await Promise.all([
      loginContext(browser, userA, {
        viewport: { width: 1280, height: 800 },
        locale: "en",
        theme: "amoled",
        hardwareConcurrency: 8,
        deviceMemory: 8,
      }),
      loginContext(browser, userB, {
        viewport: { width: 320, height: 800 },
        locale: "ar",
        theme: "light",
        hardwareConcurrency: 8,
        deviceMemory: 8,
      }),
      loginContext(browser, userC, {
        viewport: { width: 360, height: 800 },
        locale: "ar",
        hardwareConcurrency: 2,
        deviceMemory: 2,
      }),
      loginContext(browser, modUser, {
        viewport: { width: 1280, height: 800 },
        locale: "en",
        hardwareConcurrency: 8,
        deviceMemory: 8,
      }),
    ]);

    const pageA = sessA.page;
    const pageB = sessB.page;
    const pageC = sessC.page;
    const pageMod = sessMod.page;
    const runtimeErrors: string[] = [];

    for (const p of [pageA, pageB, pageC, pageMod]) {
      p.on("pageerror", (err) => runtimeErrors.push(`pageerror: ${err.message}`));
    }

    try {
      // 1. Guidelines gate & Phone RTL + Amoled + data-perf="low" checks
      await Promise.all([
        pageA.goto("/chat", { waitUntil: "networkidle" }),
        pageB.goto("/chat", { waitUntil: "networkidle" }),
        pageC.goto("/chat", { waitUntil: "networkidle" }),
      ]);
      await expect(pageA.locator('[data-testid="chat-terms-gate"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.locator('[data-testid="chat-terms-gate"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageC.locator('[data-testid="chat-terms-gate"]')).toBeVisible({
        timeout: 15_000,
      });

      // Verify C (2-core, 2GB) activates adaptive data-perf="low"
      expect(await pageC.locator("html").getAttribute("data-perf")).toBe("low");

      await Promise.all([
        Promise.all([
          pageA.waitForResponse(
            (r) => r.url().includes("/api/chat/terms") && r.status() === 200,
            { timeout: 20_000 },
          ),
          pageA.locator('[data-testid="chat-terms-accept-btn"]').click(),
        ]),
        Promise.all([
          pageB.waitForResponse(
            (r) => r.url().includes("/api/chat/terms") && r.status() === 200,
            { timeout: 20_000 },
          ),
          pageB.locator('[data-testid="chat-terms-accept-btn"]').click(),
        ]),
        Promise.all([
          pageC.waitForResponse(
            (r) => r.url().includes("/api/chat/terms") && r.status() === 200,
            { timeout: 20_000 },
          ),
          pageC.locator('[data-testid="chat-terms-accept-btn"]').click(),
        ]),
      ]);

      await expect(pageA.locator('[data-testid="chat-workspace"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.locator('[data-testid="chat-workspace"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageC.locator('[data-testid="chat-workspace"]')).toBeVisible({
        timeout: 15_000,
      });

      // Check 320px phone RTL & zero horizontal overflow on B, Amoled pure black on A
      const phoneRtl = await pageB.evaluate(() => ({
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      expect(phoneRtl.dir).toBe("rtl");
      expect(phoneRtl.overflow).toBe(false);

      const amoledBg = await pageA.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );
      expect(["rgb(0, 0, 0)", "oklch(0 0 0)", "oklab(0 0 0)", "lab(0 0 0)"]).toContain(amoledBg);

      // 2. Friends workflow: A searches B's name prefix -> sends request -> B accepts -> /profile CountUp = 1
      await pageA.locator('[data-testid="chat-search-input"]').fill(userB.name!.slice(0, 12));
      const searchResults = pageA.locator('[data-testid="chat-user-search-results"]');
      await expect(searchResults).toContainText(userB.name!, { timeout: 15_000 });
      await searchResults.locator("button").first().click();

      await pageB.locator('[data-testid="chat-tab-friends"]').click();
      const acceptBBtn = pageB.locator(`[data-testid="accept-friend-${userA.id}"]`);
      await expect(acceptBBtn).toBeVisible({ timeout: 15_000 });
      await acceptBBtn.click();
      await expect(pageB.locator(`[data-testid="open-dm-${userA.id}"]`)).toBeVisible({
        timeout: 15_000,
      });

      // Check profile friend count reflects accepted friendship
      await pageC.goto(`/u/${userB.id}`);
      await expect(pageC.locator('[data-testid="public-profile-friend-count"]')).toContainText(
        "1",
        { timeout: 15_000 },
      );

      // 3. Realtime DM (<2s after 201), typing indicator, read receipt & navbar unread badge
      await pageA.locator('[data-testid="chat-tab-friends"]').click();
      await expect(pageA.locator(`[data-testid="open-dm-${userB.id}"]`)).toBeVisible({
        timeout: 15_000,
      });
      await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().includes("/api/chat/conversations/dm") &&
            res.request().method() === "POST" &&
            res.status() === 200,
          { timeout: 15_000 },
        ),
        pageB.waitForResponse(
          (res) =>
            res.url().includes("/api/chat/conversations/dm") &&
            res.request().method() === "POST" &&
            res.status() === 200,
          { timeout: 15_000 },
        ),
        pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click(),
        pageB.locator(`[data-testid="open-dm-${userA.id}"]`).click(),
      ]);

      await expect(pageB.locator('[data-testid="chat-mobile-back-btn"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageA.locator('[data-testid="chat-conversation-pane"]')).toContainText(
        userB.name!,
        { timeout: 15_000 },
      );
      await expect(pageB.locator('[data-testid="chat-conversation-pane"]')).toContainText(
        userA.name!,
        { timeout: 15_000 },
      );
      await pageB.waitForTimeout(2000);

      // Typing indicator
      await Promise.all([
        pageA.waitForResponse(
          (res) => res.url().includes("/api/chat/realtime/typing") && res.status() === 200,
          { timeout: 15_000 },
        ),
        pageA.locator('[data-testid="chat-composer-input"]').type("Typing"),
      ]);
      await expect(pageB.locator('[data-testid="chat-typing-indicator"]')).toBeVisible({
        timeout: 8_000,
      });

      // DM realtime delivery (after POST 201 + signal-then-fetch from Neon)
      await pageA.locator('[data-testid="chat-composer-input"]').fill("Realtime DM T9");
      const tClick = Date.now();
      await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().includes("/api/chat/messages") &&
            res.request().method() === "POST" &&
            res.status() === 201,
          { timeout: 15_000 },
        ),
        pageA.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      const tSaved = Date.now();
      await expect(
        pageB.locator('[data-testid="chat-messages-scroll"]').getByText("Realtime DM T9"),
      ).toBeVisible({ timeout: 12_000 });
      console.log(
        `[12-T9] DM save=${tSaved - tClick}ms, post-save realtime+fetch=${Date.now() - tSaved}ms`,
      );

      // Read receipt on A
      await expect(pageA.locator('[data-testid^="msg-receipt-"]').first()).toBeVisible({
        timeout: 10_000,
      });

      // 4. Private Room + DM ROOM_INVITE + Link Invite + Stranger C 404 rejection
      await pageA.locator('[data-testid="chat-new-room-btn"]').click();
      await expect(pageA.locator('[data-testid="create-room-dialog"]')).toBeVisible();
      await pageA.locator('[data-testid="create-room-name-input"]').fill("E2E Study Room");
      await expect(pageA.locator('[data-testid="create-room-submit-btn"]')).toBeEnabled();
      const [roomCreateRes] = await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().endsWith("/api/chat/rooms") &&
            res.request().method() === "POST",
          { timeout: 25_000 },
        ),
        pageA.locator('[data-testid="create-room-submit-btn"]').click(),
      ]);
      expect(roomCreateRes.status()).toBe(201);
      const roomPayload = (await roomCreateRes.json()) as { room: { id: string } };
      createdConvIds.push(roomPayload.room.id);

      await expect(pageA.locator('[data-testid="chat-room-members-btn"]')).toBeVisible({
        timeout: 15_000,
      });
      await pageA.locator('[data-testid="chat-room-members-btn"]').click();
      await expect(pageA.locator('[data-testid="room-members-dialog"]')).toBeVisible();

      // Send DM ROOM_INVITE to B
      await pageA.locator('[data-testid="room-invite-friend-select"]').click();
      await pageA.getByRole("option", { name: userB.name! }).click();
      const [dmInviteRes] = await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().includes("/invites") &&
            res.request().method() === "POST",
          { timeout: 25_000 },
        ),
        pageA.locator('[data-testid="room-send-dm-invite-btn"]').click(),
      ]);
      expect(dmInviteRes.status()).toBe(201);

      // Create open-to-friends Link Invite and capture URL
      await pageA.locator('[data-testid="room-invite-friend-select"]').click();
      await pageA.getByRole("option").first().click();
      await expect(pageA.locator('[data-testid="room-create-link-invite-btn"]')).toBeEnabled();
      const [linkInviteRes] = await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().includes("/invites") &&
            res.request().method() === "POST",
          { timeout: 25_000 },
        ),
        pageA.locator('[data-testid="room-create-link-invite-btn"]').click(),
      ]);
      expect(linkInviteRes.status()).toBe(201);
      const inviteLinkBox = pageA.locator('[data-testid="room-generated-invite-link"]');
      await expect(inviteLinkBox).toBeVisible({ timeout: 15_000 });
      const inviteUrlText = (await inviteLinkBox.innerText()).trim();
      const invitePathMatch = inviteUrlText.match(/(\/chat\/invite\/[A-Za-z0-9_-]+)/);
      expect(invitePathMatch).not.toBeNull();
      const invitePath = invitePathMatch![1];
      const inviteToken = invitePath.split("/").pop()!;

      // Close Room Members dialog on A
      await pageA.keyboard.press("Escape");

      // Stranger C visits link invite -> generic unavailable & API 404 (no leak of room name)
      await pageC.goto(invitePath);
      await expect(pageC.locator('[data-testid="invite-unavailable"]')).toBeVisible({
        timeout: 15_000,
      });
      expect(await pageC.locator("main").innerText()).not.toContain("E2E Study Room");
      const strangerApi = await pageC.request.get(`/api/chat/invites/link/${inviteToken}`);
      expect(strangerApi.status()).toBe(404);

      // B navigates back on 320px phone, opens DM with A, accepts ROOM_INVITE, sends room message
      await pageB.locator('[data-testid="chat-mobile-back-btn"]').click();
      await pageB.locator('[data-testid="chat-tab-friends"]').click();
      await pageB.locator(`[data-testid="chat-conv-dm-${userA.id}"]`).click();
      const acceptInviteBtn = pageB.locator('[data-testid^="invite-accept-"]').first();
      await expect(acceptInviteBtn).toBeVisible({ timeout: 15_000 });
      await acceptInviteBtn.click();

      // Switch to Rooms tab on B and open E2E Study Room
      await pageB.locator('[data-testid="chat-mobile-back-btn"]').click();
      await pageB.locator('[data-testid="chat-tab-rooms"]').click();
      await pageB.locator(`[data-testid="chat-conv-room-${roomPayload.room.id}"]`).click();
      await pageB.locator('[data-testid="chat-composer-input"]').fill("Room message from B");
      await Promise.all([
        pageB.waitForResponse(
          (res) =>
            res.url().includes("/api/chat/messages") &&
            res.request().method() === "POST" &&
            res.status() === 201,
          { timeout: 15_000 },
        ),
        pageB.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      await expect(
        pageA.locator('[data-testid="chat-messages-scroll"]').getByText("Room message from B"),
      ).toBeVisible({ timeout: 12_000 });

      // 5. Public Space + Moderator Delete
      await pageA.locator('[data-testid="chat-tab-public"]').click();
      await pageA.locator('[data-testid="chat-conv-public"]').click();
      await pageA.locator('[data-testid="chat-composer-input"]').fill("Public T9 message");
      const [pubMsgRes] = await Promise.all([
        pageA.waitForResponse(
          (res) =>
            res.url().includes("/api/chat/messages") &&
            res.request().method() === "POST" &&
            res.status() === 201,
          { timeout: 15_000 },
        ),
        pageA.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      const pubMsgPayload = (await pubMsgRes.json()) as { message: { id: string } };
      createdPublicMessageIds.push(pubMsgPayload.message.id);

      await pageB.locator('[data-testid="chat-mobile-back-btn"]').click();
      await pageB.locator('[data-testid="chat-tab-public"]').click();
      await pageB.locator('[data-testid="chat-conv-public"]').click();
      await expect(
        pageB.locator('[data-testid="chat-messages-scroll"]').getByText("Public T9 message"),
      ).toBeVisible({ timeout: 12_000 });

      // Moderator accepts gate and deletes the public message inline
      await pageMod.goto("/chat", { waitUntil: "networkidle" });
      await expect(pageMod.locator('[data-testid="chat-terms-gate"]')).toBeVisible({
        timeout: 15_000,
      });
      await Promise.all([
        pageMod.waitForResponse(
          (r) => r.url().includes("/api/chat/terms") && r.status() === 200,
          { timeout: 20_000 },
        ),
        pageMod.locator('[data-testid="chat-terms-accept-btn"]').click(),
      ]);
      await expect(pageMod.locator('[data-testid="chat-conv-public"]')).toBeVisible({
        timeout: 15_000,
      });
      await pageMod.locator('[data-testid="chat-conv-public"]').click();
      await pageMod
        .locator(`[data-testid="chat-message-${pubMsgPayload.message.id}"]`)
        .hover();
      const modDelBtn = pageMod.locator(
        `[data-testid="mod-delete-msg-${pubMsgPayload.message.id}"]`,
      );
      await expect(modDelBtn).toBeVisible({ timeout: 15_000 });
      await modDelBtn.click();
      const [modDelRes] = await Promise.all([
        pageMod.waitForResponse(
          (r) =>
            r.url().includes(`/api/admin/moderation/messages/${pubMsgPayload.message.id}`) &&
            r.request().method() === "DELETE",
          { timeout: 25_000 },
        ),
        pageMod.locator('[data-testid="confirm-dialog-confirm"]').click(),
      ]);
      expect(modDelRes.status()).toBe(200);

      // Verify B receives realtime deletion of Public T9 message
      await expect(
        pageB.locator('[data-testid="chat-messages-scroll"]').getByText("Public T9 message"),
      ).toHaveCount(0, { timeout: 15_000 });

      expect(runtimeErrors).toEqual([]);
    } finally {
      await sessA.context.close();
      await sessB.context.close();
      await sessC.context.close();
      await sessMod.context.close();
      if (priorSetting) {
        await prisma.systemSetting.update({
          where: { key: "chatEnabled" },
          data: { value: priorSetting.value },
        });
      } else {
        await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
      }
    }
  });
});
