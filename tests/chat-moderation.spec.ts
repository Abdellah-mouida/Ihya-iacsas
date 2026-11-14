import { test, expect, type Browser } from "@playwright/test";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { acceptFriendRequest, sendFriendRequest } from "../src/lib/chat/friends";
import {
  getConversationMessages,
  openOrCreateDmConversation,
  sendMessage,
} from "../src/lib/chat/messages";
import {
  listChatModerationDashboard,
  moderateDeletePublicMessage,
  reportMessage,
  resolveChatReport,
  setGlobalChatEnabled,
  setUserChatBan,
  timeoutUserFromPublicChat,
} from "../src/lib/chat/moderation";
import { ensurePublicConversationMember } from "../src/lib/chat/realtime/channels";
import { createMessageInvite, createRoom, respondToMessageInvite } from "../src/lib/chat/rooms";
import { deleteUserAccount } from "../src/lib/user-deletion";

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";

async function createUser(
  label: string,
  role: "USER" | "MODERATOR" | "ADMIN" = "USER",
) {
  assertDevBranchDatabase("chat-moderation setup");
  const suffix = randomBytes(8).toString("hex");
  const email = `mod.${label.toLowerCase()}.${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");

  const user = await prisma.user.create({
    data: {
      email,
      name: `Mod_${label}_${suffix.slice(0, 6)}`,
      city: "Casablanca",
      age: 24,
      passwordHash: await bcrypt.hash(password, 6),
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-16",
      onboardingCompletedAt: new Date(),
      chatTermsAcceptedAt: new Date(),
      role,
      sessionVersion: 1,
    },
    select: { id: true, email: true, name: true, role: true },
  });
  return { ...user, email, password };
}

async function loginContext(
  browser: Browser,
  email: string,
  password: string,
) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    locale: "en-US",
  });
  await ctx.addInitScript(() => {
    localStorage.setItem("ihyaa-locale", "en");
  });
  const page = await ctx.newPage();
  await page.goto("/login?callbackUrl=/profile", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({
    timeout: 15_000,
  });
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/profile(?:\?.*)?$/, {
    timeout: 25_000,
  });
  return { ctx, page };
}

test("moderation service, encrypted snapshots, role boundaries, and account deletion cascade", async () => {
  test.setTimeout(180_000);
  assertDevBranchDatabase("chat-moderation service");

  const userIds: string[] = [];
  const convIds: string[] = [];
  const messageIds: string[] = [];
  const reportIds: string[] = [];

  const prevChatSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" },
    select: { value: true },
  });

  try {
    const [admin, mod, mod2, alice, bob] = await Promise.all([
      createUser("Admin", "ADMIN"),
      createUser("Mod", "MODERATOR"),
      createUser("Mod2", "MODERATOR"),
      createUser("Alice", "USER"),
      createUser("Bob", "USER"),
    ]);
    userIds.push(admin.id, mod.id, mod2.id, alice.id, bob.id);

    const modActor = {
      id: mod.id,
      name: mod.name,
      email: mod.email,
      role: "MODERATOR" as const,
    };
    const adminActor = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN" as const,
    };

    await setGlobalChatEnabled({ enabled: true, actor: adminActor });

    // Friends + DM + Public + Rooms
    await sendFriendRequest(alice.id, bob.id);
    await acceptFriendRequest(bob.id, alice.id);

    const publicConvId = await ensurePublicConversationMember(alice.id);
    if (!publicConvId) throw new Error("PUBLIC conversation missing");
    await ensurePublicConversationMember(bob.id);

    const pubMsg = await sendMessage({
      userId: alice.id,
      conversationId: publicConvId,
      body: "Public message for moderation test",
    });
    messageIds.push(pubMsg.message.id);

    const dmConv = await openOrCreateDmConversation(alice.id, bob.id);
    convIds.push(dmConv.id);
    const dmMsg = await sendMessage({
      userId: alice.id,
      conversationId: dmConv.id,
      body: "Private DM secret content",
    });
    messageIds.push(dmMsg.message.id);

    const soloRoom = await createRoom(alice.id, {
      name: "Alice Solo Room",
      emoji: "🌿",
      accentColor: "main",
      memberCap: 10,
      membersCanInvite: true,
    });
    convIds.push(soloRoom.id);

    const sharedRoom = await createRoom(alice.id, {
      name: "Shared Study Room",
      emoji: "📖",
      accentColor: "brass",
      memberCap: 10,
      membersCanInvite: true,
    });
    convIds.push(sharedRoom.id);
    const bobInv = await createMessageInvite(alice.id, {
      roomId: sharedRoom.id,
      inviteeId: bob.id,
    });
    await respondToMessageInvite(bob.id, bobInv.invite.id, "accept");
    const roomMsg = await sendMessage({
      userId: alice.id,
      conversationId: sharedRoom.id,
      body: "Shared room note before leaving",
    });
    messageIds.push(roomMsg.message.id);

    // 1. Report public message; verify frozen snapshot + audit without plaintext
    await expect(
      reportMessage({
        reporterId: alice.id,
        messageId: pubMsg.message.id,
        reason: "Self report",
      }),
    ).rejects.toMatchObject({ status: 400 });

    const rep = await reportMessage({
      reporterId: bob.id,
      reporterName: bob.name,
      messageId: pubMsg.message.id,
      reason: "Off-topic spam test",
    });
    reportIds.push(rep.id);

    await expect(
      reportMessage({
        reporterId: bob.id,
        reporterName: bob.name,
        messageId: pubMsg.message.id,
        reason: "Duplicate open report",
      }),
    ).rejects.toMatchObject({ status: 409 });

    const dash = await listChatModerationDashboard({
      status: "OPEN",
      search: alice.email,
    });
    const foundReport = dash.reports.find((r) => r.id === rep.id);
    expect(foundReport?.snapshotBody).toBe("Public message for moderation test");

    const createLog = await prisma.auditLog.findFirst({
      where: { action: "CHAT_REPORT_CREATE", targetId: rep.id },
    });
    expect(createLog).not.toBeNull();
    expect(JSON.stringify(createLog?.details ?? {})).not.toContain(
      "Public message for moderation test",
    );

    // 2. Role & privacy boundaries: cannot delete DM, cannot timeout/ban ADMIN or MOD
    await expect(
      moderateDeletePublicMessage({
        messageId: dmMsg.message.id,
        actor: modActor,
      }),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      timeoutUserFromPublicChat({
        targetUserId: admin.id,
        hours: 1,
        actor: modActor,
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      setUserChatBan({
        targetUserId: mod2.id,
        banned: true,
        actor: modActor,
      }),
    ).rejects.toMatchObject({ status: 403 });

    // 3. Moderator deletes public message, timeouts & bans Bob, resolves report
    await moderateDeletePublicMessage({
      messageId: pubMsg.message.id,
      actor: modActor,
      reason: "Test removal",
    });

    const deletedPubRow = await prisma.message.findUnique({
      where: { id: pubMsg.message.id },
      select: { ciphertext: true, deletedAt: true },
    });
    expect(deletedPubRow?.ciphertext).toBe("");
    expect(deletedPubRow?.deletedAt).not.toBeNull();

    // Snapshot in report stays intact after source message is deleted!
    const dashAfterDelete = await listChatModerationDashboard({ status: "OPEN" });
    expect(
      dashAfterDelete.reports.find((r) => r.id === rep.id)?.snapshotBody,
    ).toBe("Public message for moderation test");

    await timeoutUserFromPublicChat({
      targetUserId: bob.id,
      hours: 2,
      actor: modActor,
    });
    await setUserChatBan({
      targetUserId: bob.id,
      banned: true,
      actor: modActor,
      reason: "Ban test",
    });
    await setUserChatBan({
      targetUserId: bob.id,
      banned: false,
      actor: modActor,
    });
    await timeoutUserFromPublicChat({
      targetUserId: bob.id,
      hours: 0,
      actor: modActor,
    });
    await resolveChatReport({
      reportId: rep.id,
      actor: modActor,
      status: "RESOLVED",
      resolutionNote: "Handled",
    });

    // 4. Account deletion cascade for Alice
    const keepPubMsg = await sendMessage({
      userId: alice.id,
      conversationId: publicConvId,
      body: "Alice public note kept anonymized",
    });
    messageIds.push(keepPubMsg.message.id);

    await deleteUserAccount({
      targetUserId: alice.id,
      actorId: alice.id,
      action: "ACCOUNT_DELETE",
    });

    // Solo room deleted, DM deleted, shared room transferred to Bob
    expect(
      await prisma.conversation.findUnique({ where: { id: soloRoom.id } }),
    ).toBeNull();
    expect(
      await prisma.conversation.findUnique({ where: { id: dmConv.id } }),
    ).toBeNull();
    const updatedSharedRoom = await prisma.conversation.findUnique({
      where: { id: sharedRoom.id },
      select: { ownerId: true },
    });
    expect(updatedSharedRoom?.ownerId).toBe(bob.id);

    // Remaining messages in PUBLIC and sharedRoom are anonymized and still decrypt cleanly!
    const pubAnon = await prisma.message.findUnique({
      where: { id: keepPubMsg.message.id },
      select: { senderId: true, isAnonymized: true },
    });
    expect(pubAnon).toEqual({ senderId: null, isAnonymized: true });

    const bobRoomPage = await getConversationMessages({
      userId: bob.id,
      conversationId: sharedRoom.id,
    });
    const anonRoomMsg = bobRoomPage.messages.find((m) => m.id === roomMsg.message.id);
    expect(anonRoomMsg?.isAnonymized).toBe(true);
    expect(anonRoomMsg?.sender).toBeNull();
    expect(anonRoomMsg?.body).toBe("Shared room note before leaving");
  } finally {
    if (reportIds.length) {
      await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
    }
    if (messageIds.length) {
      await prisma.message.deleteMany({ where: { id: { in: messageIds } } });
    }
    if (convIds.length) {
      await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    if (userIds.length) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: userIds } },
            { targetId: { in: userIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (prevChatSetting) {
      await prisma.systemSetting.upsert({
        where: { key: "chatEnabled" },
        update: { value: prevChatSetting.value },
        create: { key: "chatEnabled", value: prevChatSetting.value },
      });
    } else {
      await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
    }
  }
});

test("browser moderation flow, global chatEnabled switch, and /privacy messaging section", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  assertDevBranchDatabase("chat-moderation browser");

  const userIds: string[] = [];
  const messageIds: string[] = [];
  const reportIds: string[] = [];

  const prevChatSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" },
    select: { value: true },
  });

  try {
    const [admin, mod, alice, bob] = await Promise.all([
      createUser("E2EAdmin", "ADMIN"),
      createUser("E2EMod", "MODERATOR"),
      createUser("E2EAlice", "USER"),
      createUser("E2EBob", "USER"),
    ]);
    userIds.push(admin.id, mod.id, alice.id, bob.id);

    // Ensure chatEnabled starts OFF for 404 check, then ADMIN toggles ON via UI!
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "false" },
      create: { key: "chatEnabled", value: "false" },
    });

    const adminLogin = await loginContext(browser, admin.email, admin.password);
    const aliceLogin = await loginContext(browser, alice.email, alice.password);
    const bobLogin = await loginContext(browser, bob.email, bob.password);
    const modLogin = await loginContext(browser, mod.email, mod.password);

    try {
      // 1. Regular user blocked from /admin/moderation
      await aliceLogin.page.goto("/admin/moderation", {
        waitUntil: "domcontentloaded",
      });
      await expect(aliceLogin.page).not.toHaveURL(/\/admin\/moderation/);
      const forbiddenApi = await aliceLogin.page.evaluate(async () => {
        const res = await fetch("/api/admin/moderation");
        return res.status;
      });
      expect(forbiddenApi).toBe(403);

      // 2. When chatEnabled is false, /api/chat/friends returns 404
      const disabledFriendsStatus = await aliceLogin.page.evaluate(async () => {
        const res = await fetch("/api/chat/friends");
        return res.status;
      });
      expect(disabledFriendsStatus).toBe(404);

      // 3. Admin enables chatEnabled via /admin/moderation toggle
      await adminLogin.page.goto("/admin/moderation", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        adminLogin.page.locator('[data-testid="admin-chat-enabled-status"]'),
      ).toHaveText("Disabled", { timeout: 15_000 });
      await adminLogin.page
        .locator('[data-testid="admin-chat-enabled-toggle"]')
        .click();
      await adminLogin.page
        .locator('[data-testid="confirm-dialog-confirm"]')
        .click();
      await expect(
        adminLogin.page.locator('[data-testid="admin-chat-enabled-status"]'),
      ).toHaveText("Enabled", { timeout: 15_000 });

      // 4. Alice posts in Public Space, Bob reports via UI dialog
      await aliceLogin.page.goto("/chat", { waitUntil: "domcontentloaded" });
      await expect(
        aliceLogin.page.locator('[data-testid="chat-composer-input"]'),
      ).toBeVisible({ timeout: 20_000 });

      const uniqueText = `Reportable public msg ${randomBytes(4).toString("hex")}`;
      await aliceLogin.page
        .locator('[data-testid="chat-composer-input"]')
        .fill(uniqueText);
      const [sendRes] = await Promise.all([
        aliceLogin.page.waitForResponse(
          (r) =>
            r.url().includes("/api/chat/messages") &&
            r.request().method() === "POST" &&
            r.status() === 201,
          { timeout: 15_000 },
        ),
        aliceLogin.page.locator('[data-testid="chat-send-btn"]').click(),
      ]);
      const sendJson = (await sendRes.json()) as {
        message: { id: string };
      };
      messageIds.push(sendJson.message.id);

      await bobLogin.page.goto("/chat", { waitUntil: "domcontentloaded" });
      await expect(bobLogin.page.getByText(uniqueText)).toBeVisible({
        timeout: 20_000,
      });

      const reportBtn = bobLogin.page.locator(
        `[data-testid="report-msg-${sendJson.message.id}"]`,
      );
      await reportBtn.click();
      await expect(
        bobLogin.page.locator('[data-testid="chat-report-dialog"]'),
      ).toBeVisible({ timeout: 10_000 });
      await bobLogin.page
        .locator('[data-testid="chat-report-reason-input"]')
        .fill("Inappropriate spam in public space");
      const submitReportBtn = bobLogin.page.locator('[data-testid="chat-report-submit-btn"]');
      await expect(submitReportBtn).toBeEnabled({ timeout: 5_000 });
      const [repRes] = await Promise.all([
        bobLogin.page.waitForResponse(
          (r) =>
            r.url().includes("/api/chat/reports") &&
            r.request().method() === "POST",
          { timeout: 25_000 },
        ),
        submitReportBtn.click(),
      ]);
      const repJson = (await repRes.json()) as { report?: { id: string }; error?: string };
      expect(repRes.status(), JSON.stringify(repJson)).toBe(201);
      if (!repJson.report?.id) throw new Error("Missing report id");
      reportIds.push(repJson.report.id);

      // 5. Moderator reviews report, deletes public message, timeouts Alice, resolves report
      await modLogin.page.goto("/admin/moderation", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        modLogin.page.locator(
          `[data-testid="moderation-snapshot-${repJson.report.id}"]`,
        ),
      ).toHaveText(uniqueText, { timeout: 15_000 });
      await expect(
        modLogin.page.locator('[data-testid="admin-chat-enabled-toggle"]'),
      ).toHaveCount(0);

      await modLogin.page
        .locator(`[data-testid="moderation-delete-msg-${repJson.report.id}"]`)
        .click();
      await modLogin.page
        .locator('[data-testid="confirm-dialog-confirm"]')
        .click();
      await expect(
        modLogin.page.locator(
          `[data-testid="moderation-delete-msg-${repJson.report.id}"]`,
        ),
      ).toHaveCount(0, { timeout: 15_000 });

      await Promise.all([
        modLogin.page.waitForResponse(
          (r) =>
            r.url().includes("/api/admin/moderation/users/") &&
            r.url().includes("/timeout") &&
            r.status() === 200,
          { timeout: 15_000 },
        ),
        modLogin.page
          .locator(`[data-testid="moderation-timeout-24h-${repJson.report.id}"]`)
          .click(),
      ]);
      const resolveBtn = modLogin.page.locator(
        `[data-testid="moderation-resolve-${repJson.report.id}"]`,
      );
      await expect(resolveBtn).toBeEnabled({ timeout: 10_000 });
      await resolveBtn.click();
      await expect(
        modLogin.page.locator(
          `[data-testid="moderation-report-${repJson.report.id}"]`,
        ),
      ).toHaveCount(0, { timeout: 15_000 });

      // 6. Verify /privacy messaging section exists in EN
      await aliceLogin.page.goto("/privacy", { waitUntil: "domcontentloaded" });
      await expect(
        aliceLogin.page.locator("#messaging"),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        aliceLogin.page.locator("#messaging"),
      ).toContainText("AES-256-GCM");
    } finally {
      await Promise.all([
        adminLogin.ctx.close(),
        aliceLogin.ctx.close(),
        bobLogin.ctx.close(),
        modLogin.ctx.close(),
      ]);
    }
  } finally {
    if (reportIds.length) {
      await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
    }
    if (messageIds.length) {
      await prisma.message.deleteMany({ where: { id: { in: messageIds } } });
    }
    if (userIds.length) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: { in: userIds } },
            { targetId: { in: userIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (prevChatSetting) {
      await prisma.systemSetting.upsert({
        where: { key: "chatEnabled" },
        update: { value: prevChatSetting.value },
        create: { key: "chatEnabled", value: prevChatSetting.value },
      });
    } else {
      await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
    }
  }
});
