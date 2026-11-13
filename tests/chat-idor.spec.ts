import { test, expect, type APIRequestContext, type Browser } from "@playwright/test";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { parseSafeMessageSegments } from "../src/lib/chat/links";
import {
  deleteMessage,
  editMessage,
  getConversationMessageById,
  getConversationMessages,
  listConversationsForUser,
  markConversationRead,
  openOrCreateDmConversation,
  sendMessage,
  setConversationMuted,
} from "../src/lib/chat/messages";
import { acceptFriendRequest, blockUser, sendFriendRequest } from "../src/lib/chat/friends";

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";

async function createUser(label: string, opts?: { terms?: boolean; onboarded?: boolean }) {
  assertDevBranchDatabase("chat-idor setup");
  const suffix = randomBytes(8).toString("hex");
  const email = `idor.${label.toLowerCase()}.${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const onboarded = opts?.onboarded ?? true;
  const terms = opts?.terms ?? true;

  const user = await prisma.user.create({
    data: {
      email,
      name: `Idor_${label}_${suffix.slice(0, 6)}`,
      city: "Casablanca",
      age: 22,
      passwordHash: await bcrypt.hash(password, 10),
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: onboarded ? new Date() : null,
      chatTermsAcceptedAt: terms ? new Date() : null,
      role: "USER",
      sessionVersion: 1,
    },
    select: { id: true, email: true, name: true },
  });
  return { ...user, password };
}

async function loginContext(
  browser: Browser,
  email: string,
  password: string,
): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; request: APIRequestContext }> {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  await page.goto("/login?callbackUrl=/profile");
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/profile(?:\?.*)?$/, { timeout: 25_000 });
  await page.close();
  return { context, request: context.request };
}

test.describe("12-T4: Unified Message Pipeline, Linkifier & IDOR Matrix", () => {
  test.describe.configure({ timeout: 240_000 });

  test("safe http(s) linkifier blocks javascript/data/HTML payloads", () => {
    const segments = parseSafeMessageSegments(
      "Visit https://ihyaa.ma/events?id=1. Also ignore javascript:alert(1) and data:text/html,<script>x</script> and http://example.org/ok!",
    );
    const links = segments.filter((s) => s.type === "link");
    expect(links.map((l) => l.href)).toEqual([
      "https://ihyaa.ma/events?id=1",
      "http://example.org/ok",
    ]);
    const joined = segments.map((s) => s.value).join("");
    expect(joined).toContain("javascript:alert(1)");
    expect(joined).toContain("data:text/html");
  });

  test("service pipeline: Public, DM, Room, cursor pagination, idempotency, edit/delete & IDOR", async () => {
    assertDevBranchDatabase("chat-idor service");
    const [a, b, c] = await Promise.all([
      createUser("SrvA"),
      createUser("SrvB"),
      createUser("SrvC"),
    ]);

    let dmId = "";
    let roomId = "";

    try {
      // Public room must exist
      const pub = await prisma.conversation.findUnique({ where: { publicKey: "PUBLIC" } });
      expect(pub).toBeTruthy();

      // Non-friends cannot open DM
      await expect(openOrCreateDmConversation(a.id, b.id)).rejects.toMatchObject({ status: 403 });

      // Become friends -> open DM
      await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
      await acceptFriendRequest(b.id, a.id);
      const dm = await openOrCreateDmConversation(a.id, b.id);
      dmId = dm.id;

      // Create private room with A & B (C is NOT a member)
      const room = await prisma.conversation.create({
        data: {
          type: "ROOM",
          name: "Private Study Circle",
          ownerId: a.id,
          members: {
            create: [
              { userId: a.id, role: "OWNER" },
              { userId: b.id, role: "MEMBER" },
            ],
          },
        },
        select: { id: true },
      });
      roomId = room.id;

      // Idempotency via clientId
      const clientKey = `cli_${randomBytes(6).toString("hex")}`;
      const s1 = await sendMessage({
        userId: a.id,
        conversationId: dmId,
        body: "Salam Alaikum https://ihyaa.ma",
        clientId: clientKey,
      });
      expect(s1.deduplicated).toBe(false);

      const s2 = await sendMessage({
        userId: a.id,
        conversationId: dmId,
        body: "Salam Alaikum https://ihyaa.ma",
        clientId: clientKey,
      });
      expect(s2.deduplicated).toBe(true);
      expect(s2.message.id).toBe(s1.message.id);

      // Verify ciphertext stored in DB does not contain plaintext
      const rawMsg = await prisma.message.findUnique({ where: { id: s1.message.id } });
      expect(rawMsg?.ciphertext).toBeTruthy();
      expect(rawMsg?.ciphertext).not.toContain("Salam Alaikum");

      // Send 4 messages in room for pagination test
      for (let i = 1; i <= 4; i++) {
        await sendMessage({
          userId: i % 2 === 0 ? b.id : a.id,
          conversationId: roomId,
          body: `Room msg ${i}`,
        });
      }

      const page1 = await getConversationMessages({
        userId: a.id,
        conversationId: roomId,
        limit: 2,
      });
      expect(page1.messages.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeTruthy();

      const page2 = await getConversationMessages({
        userId: a.id,
        conversationId: roomId,
        cursor: page1.nextCursor,
        limit: 2,
      });
      expect(page2.messages.length).toBe(2);
      expect(page2.hasMore).toBe(false);
      const ids = [...page1.messages, ...page2.messages].map((m) => m.id);
      expect(new Set(ids).size).toBe(4);

      // Unread count for B in DM (1 message from A), cleared on markConversationRead
      const beforeRead = await listConversationsForUser(b.id);
      const dmSummaryB = beforeRead.conversations.find((conv) => conv.id === dmId);
      expect(dmSummaryB?.unreadCount).toBe(1);

      await markConversationRead({ userId: b.id, conversationId: dmId });
      const afterRead = await listConversationsForUser(b.id);
      expect(afterRead.conversations.find((conv) => conv.id === dmId)?.unreadCount).toBe(0);

      // Mute toggle
      expect(await setConversationMuted({ userId: b.id, conversationId: dmId, muted: true })).toBe(
        true,
      );

      // Length > 2000 rejected
      await expect(
        sendMessage({
          userId: a.id,
          conversationId: dmId,
          body: "x".repeat(2001),
        }),
      ).rejects.toMatchObject({ status: 400, code: "MESSAGE_TOO_LONG" });

      // Edit & delete own message; member B cannot edit/delete A's message
      const edited = await editMessage({
        userId: a.id,
        messageId: s1.message.id,
        body: "Edited Salam",
      });
      expect(edited.body).toBe("Edited Salam");
      expect(edited.editedAt).toBeTruthy();

      await expect(
        editMessage({ userId: b.id, messageId: s1.message.id, body: "Hijack" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        deleteMessage({ userId: b.id, messageId: s1.message.id }),
      ).rejects.toMatchObject({ status: 403 });

      const deleted = await deleteMessage({ userId: a.id, messageId: s1.message.id });
      expect(deleted.deleted).toBe(true);
      expect(deleted.body).toBe("");

      // Stranger C IDOR matrix -> 404 everywhere (never reveals existence)
      await expect(
        getConversationMessages({ userId: c.id, conversationId: dmId }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        getConversationMessages({ userId: c.id, conversationId: roomId }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        sendMessage({ userId: c.id, conversationId: roomId, body: "Intrude" }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        getConversationMessageById({ userId: c.id, messageId: page1.messages[0]!.id }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        markConversationRead({ userId: c.id, conversationId: roomId }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        setConversationMuted({ userId: c.id, conversationId: roomId, muted: true }),
      ).rejects.toMatchObject({ status: 404 });

      // Public slow mode blocks 2nd message within 2s
      await sendMessage({
        userId: a.id,
        conversationId: pub!.id,
        body: "Public hello 1",
      });
      await expect(
        sendMessage({
          userId: a.id,
          conversationId: pub!.id,
          body: "Public hello 2",
        }),
      ).rejects.toMatchObject({ status: 429, code: "SLOW_MODE" });

      // Blocking B revokes B's DM access immediately
      await blockUser(a.id, b.id);
      await expect(
        getConversationMessages({ userId: b.id, conversationId: dmId }),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await prisma.message.deleteMany({
        where: { senderId: { in: [a.id, b.id, c.id] } },
      });
      if (dmId) await prisma.conversation.deleteMany({ where: { id: dmId } });
      if (roomId) await prisma.conversation.deleteMany({ where: { id: roomId } });
      await prisma.rateLimit.deleteMany({
        where: {
          OR: [
            { key: { contains: a.id } },
            { key: { contains: b.id } },
            { key: { contains: c.id } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    }
  });

  test("HTTP IDOR matrix: non-member C gets identical 404 across real & fake room/message IDs", async ({
    browser,
  }) => {
    assertDevBranchDatabase("chat-idor http");
    const [a, b, c, noTerms] = await Promise.all([
      createUser("HttpA"),
      createUser("HttpB"),
      createUser("HttpC"),
      createUser("NoTerms", { terms: false }),
    ]);

    const priorSetting = await prisma.systemSetting.findUnique({ where: { key: "chatEnabled" } });
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "true" },
      create: { key: "chatEnabled", value: "true" },
    });

    await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
    await acceptFriendRequest(b.id, a.id);
    const dm = await openOrCreateDmConversation(a.id, b.id);
    const room = await prisma.conversation.create({
      data: {
        type: "ROOM",
        name: "Secret Room",
        ownerId: a.id,
        members: {
          create: [
            { userId: a.id, role: "OWNER" },
            { userId: b.id, role: "MEMBER" },
          ],
        },
      },
      select: { id: true },
    });

    const ctxA = await loginContext(browser, a.email!, a.password);
    const ctxC = await loginContext(browser, c.email!, c.password);
    const ctxNoTerms = await loginContext(browser, noTerms.email!, noTerms.password);
    const anonCtx = await browser.newContext({ baseURL: BASE });

    try {
      // Unauthenticated -> 401
      const anonRes = await anonCtx.request.get("/api/chat/conversations");
      expect(anonRes.status()).toBe(401);

      // Terms not accepted -> 403 until POST /api/chat/terms
      const blockedNoTerms = await ctxNoTerms.request.get("/api/chat/conversations");
      expect(blockedNoTerms.status()).toBe(403);
      const acceptRes = await ctxNoTerms.request.post("/api/chat/terms", {
        data: { accepted: true },
      });
      expect(acceptRes.status()).toBe(200);
      const okAfterTerms = await ctxNoTerms.request.get("/api/chat/conversations");
      expect(okAfterTerms.status()).toBe(200);

      // A sends message in Room
      const postRes = await ctxA.request.post("/api/chat/messages", {
        data: { conversationId: room.id, body: "Confidential room note" },
      });
      expect(postRes.status()).toBe(201);
      const postJson = await postRes.json();
      const msgId = postJson.message.id as string;

      // Stranger C tries reading, posting, fetching by id, editing, deleting, reading, muting, backfilling
      const fakeId = "conv_nonexistent_id_12345";
      const fakeMsgId = "msg_nonexistent_id_12345";

      const checks = await Promise.all(
        [room.id, dm.id, fakeId].flatMap((targetConv) => [
          ctxC.request.get(`/api/chat/messages?conversationId=${targetConv}`),
          ctxC.request.post("/api/chat/messages", {
            data: { conversationId: targetConv, body: "probe" },
          }),
          ctxC.request.post(`/api/chat/conversations/${targetConv}/read`),
          ctxC.request.patch(`/api/chat/conversations/${targetConv}/mute`, {
            data: { muted: true },
          }),
          ctxC.request.get(`/api/chat/realtime/backfill?conversationId=${targetConv}`),
        ]),
      );
      for (const res of checks) {
        expect(res.status()).toBe(404);
      }

      // Single message fetch/edit/delete by stranger C returns 404 (same as nonexistent msgId)
      const msgChecks = await Promise.all(
        [msgId, fakeMsgId].flatMap((targetMsg) => [
          ctxC.request.get(`/api/chat/messages/${targetMsg}`),
          ctxC.request.patch(`/api/chat/messages/${targetMsg}`, {
            data: { body: "tamper" },
          }),
          ctxC.request.delete(`/api/chat/messages/${targetMsg}`),
        ]),
      );
      for (const res of msgChecks) {
        expect(res.status()).toBe(404);
      }

      // Stranger C's realtime token never includes A+B room or DM channels
      const tokRes = await ctxC.request.get("/api/chat/realtime/token");
      expect(tokRes.status()).toBe(200);
      const tokJson = await tokRes.json();
      expect(tokJson.channels).not.toContain(`conv:${room.id}`);
      expect(tokJson.channels).not.toContain(`conv:${dm.id}`);
    } finally {
      await ctxA.context.close();
      await ctxC.context.close();
      await ctxNoTerms.context.close();
      await anonCtx.close();
      await prisma.message.deleteMany({
        where: { senderId: { in: [a.id, b.id, c.id, noTerms.id] } },
      });
      await prisma.conversation.deleteMany({ where: { id: { in: [dm.id, room.id] } } });
      await prisma.rateLimit.deleteMany({
        where: {
          OR: [
            { key: { contains: a.id } },
            { key: { contains: b.id } },
            { key: { contains: c.id } },
            { key: { contains: noTerms.id } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id, c.id, noTerms.id] } } });
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
