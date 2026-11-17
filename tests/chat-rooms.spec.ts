import { test, expect, type Browser } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import {
  acceptFriendRequest,
  blockUser,
  sendFriendRequest,
  unblockUser,
} from "../src/lib/chat/friends";
import { getConversationMessages } from "../src/lib/chat/messages";
import {
  createLinkInvite,
  createMessageInvite,
  createRoom,
  deleteRoom,
  getRoomDetails,
  inspectLinkInvite,
  leaveRoom,
  removeRoomMember,
  respondToLinkInvite,
  respondToMessageInvite,
  revokeInvite,
  transferRoomOwnership,
  updateRoomSettings,
} from "../src/lib/chat/rooms";

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";

async function createUser(label: string) {
  assertDevBranchDatabase("chat-rooms setup");
  const suffix = randomBytes(8).toString("hex");
  const email = `rooms.${label.toLowerCase()}.${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");

  const user = await prisma.user.create({
    data: {
      email,
      name: `Room_${label}_${suffix.slice(0, 6)}`,
      city: "Rabat",
      age: 23,
      passwordHash: await bcrypt.hash(password, 6),
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: new Date(),
      chatTermsAcceptedAt: new Date(),
      role: "USER",
      sessionVersion: 1,
    },
    select: { id: true, email: true, name: true },
  });
  return { ...user, email, password };
}

async function makeFriends(aId: string, bId: string) {
  await sendFriendRequest(aId, bId);
  await acceptFriendRequest(bId, aId);
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
  await page.goto("/login?callbackUrl=/profile", { waitUntil: "domcontentloaded" });
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

test("rooms, dual invites, friend-only enforcement, chain O->A->B and permission switch", async () => {
  test.setTimeout(180_000);
  assertDevBranchDatabase("chat-rooms service");
  const users: string[] = [];
  const convIds: string[] = [];

  try {
    const [owner, friendA, friendB, stranger] = await Promise.all([
      createUser("Owner"),
      createUser("FriendA"),
      createUser("FriendB"),
      createUser("Stranger"),
    ]);
    users.push(owner.id, friendA.id, friendB.id, stranger.id);

    // Owner <-> A and A <-> B are friends; Owner is NOT friends with B; Stranger has no friends.
    await makeFriends(owner.id, friendA.id);
    await makeFriends(friendA.id, friendB.id);

    const room = await createRoom(owner.id, {
      name: "Study Circle",
      emoji: "📖",
      accentColor: "brass",
      memberCap: 10,
      membersCanInvite: true,
    });
    convIds.push(room.id);

    // Non-friend cannot be invited by owner
    await expect(
      createMessageInvite(owner.id, { roomId: room.id, inviteeId: friendB.id }),
    ).rejects.toThrow(/friends/i);

    // Owner invites Friend A via ROOM_INVITE DM message
    const msgInviteRes = await createMessageInvite(owner.id, {
      roomId: room.id,
      inviteeId: friendA.id,
    });
    convIds.push(msgInviteRes.dmConversationId);

    // Verify DM message carries invite id without secrets
    const dmHistory = await getConversationMessages({
      userId: friendA.id,
      conversationId: msgInviteRes.dmConversationId,
    });
    const inviteMsg = dmHistory.messages.find(
      (m) => m.id === msgInviteRes.invite.messageId,
    );
    expect(inviteMsg?.type).toBe("ROOM_INVITE");
    expect(inviteMsg?.invite?.id).toBe(msgInviteRes.invite.id);
    expect(inviteMsg?.invite?.roomName).toBe("Study Circle");

    // Inviter and stranger cannot accept A's message invite
    await expect(
      respondToMessageInvite(owner.id, msgInviteRes.invite.id, "accept"),
    ).rejects.toThrow();
    await expect(
      respondToMessageInvite(stranger.id, msgInviteRes.invite.id, "accept"),
    ).rejects.toThrow();

    // A accepts message invite -> joins room
    const acceptedA = await respondToMessageInvite(
      friendA.id,
      msgInviteRes.invite.id,
      "accept",
    );
    expect(acceptedA.status).toBe("ACCEPTED");
    expect(acceptedA.roomId).toBe(room.id);

    // Message invite cannot be reused
    await expect(
      respondToMessageInvite(friendA.id, msgInviteRes.invite.id, "accept"),
    ).rejects.toThrow(/no longer active/i);

    // Chain: Member A creates an open-to-friends link invite (128-bit token, SHA-256 stored only)
    const linkInvite = await createLinkInvite(friendA.id, {
      roomId: room.id,
      maxUses: 1,
      expiresInHours: 48,
    });
    expect(linkInvite.token.length).toBeGreaterThanOrEqual(20);

    const dbInvite = await prisma.invite.findUnique({
      where: { id: linkInvite.inviteId },
      select: { tokenHash: true },
    });
    const expectedHash = createHash("sha256")
      .update(linkInvite.token, "utf8")
      .digest("hex");
    expect(dbInvite?.tokenHash).toBe(expectedHash);
    expect(dbInvite?.tokenHash).not.toBe(linkInvite.token);

    // Stranger (not a friend of A) cannot inspect or accept leaked link; gets generic error
    await expect(inspectLinkInvite(stranger.id, linkInvite.token)).rejects.toThrow(
      /invalid or unavailable/i,
    );
    await expect(
      respondToLinkInvite(stranger.id, linkInvite.token, "accept"),
    ).rejects.toThrow(/invalid or unavailable/i);

    // Invalid token gives the exact same generic error
    await expect(
      inspectLinkInvite(friendB.id, "invalid_token_1234567890"),
    ).rejects.toThrow(/invalid or unavailable/i);

    // Friend B (friend of A, even though not friends with Owner) inspects and accepts -> joins room
    const previewB = await inspectLinkInvite(friendB.id, linkInvite.token);
    expect(previewB.roomName).toBe("Study Circle");
    expect(previewB.inviterId).toBe(friendA.id);
    const joinedB = await respondToLinkInvite(
      friendB.id,
      linkInvite.token,
      "accept",
    );
    expect(joinedB.status).toBe("ACCEPTED");
    expect(joinedB.roomId).toBe(room.id);

    // Single-use link is now exhausted
    await expect(inspectLinkInvite(friendB.id, linkInvite.token)).rejects.toThrow(
      /invalid or unavailable/i,
    );

    const detailsAfterChain = await getRoomDetails(owner.id, room.id);
    expect(detailsAfterChain.memberCount).toBe(3);

    // Permission switch: Owner disables membersCanInvite -> A can no longer invite
    await updateRoomSettings(owner.id, room.id, { membersCanInvite: false });
    await expect(
      createLinkInvite(friendA.id, { roomId: room.id }),
    ).rejects.toThrow(/owner/i);
    await expect(
      createMessageInvite(friendA.id, { roomId: room.id, inviteeId: friendB.id }),
    ).rejects.toThrow(/owner/i);

    // Owner can still create & revoke a targeted link invite
    const revocableLink = await createLinkInvite(owner.id, {
      roomId: room.id,
      inviteeId: friendA.id,
    }).catch(() => null);
    expect(revocableLink).toBeNull(); // A is already a member!

    // Block enforcement: if A blocks B, A's new link cannot be used by B
    await updateRoomSettings(owner.id, room.id, { membersCanInvite: true });
    await removeRoomMember(owner.id, room.id, friendB.id);
    const secondLink = await createLinkInvite(friendA.id, { roomId: room.id });
    await blockUser(friendA.id, friendB.id);
    await expect(
      inspectLinkInvite(friendB.id, secondLink.token),
    ).rejects.toThrow(/invalid or unavailable/i);
    await unblockUser(friendA.id, friendB.id);
    await revokeInvite(owner.id, secondLink.inviteId);

    // Owner cannot leave while A is still in room until ownership is transferred
    await expect(leaveRoom(owner.id, room.id)).rejects.toThrow(
      /transfer ownership/i,
    );

    // Transfer ownership to A, then old owner leaves, then A deletes room
    await transferRoomOwnership(owner.id, room.id, friendA.id);
    const leftRes = await leaveRoom(owner.id, room.id);
    expect(leftRes.deleted).toBe(false);
    await deleteRoom(friendA.id, room.id);
    const deletedRoom = await prisma.conversation.findUnique({
      where: { id: room.id },
    });
    expect(deletedRoom).toBeNull();
  } finally {
    if (convIds.length > 0) {
      await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    if (users.length > 0) {
      await prisma.rateLimit.deleteMany({
        where: {
          OR: users.map((id) => ({ key: { contains: id } })),
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
  }
});

test("browser invite link page hides room details from strangers and lets friend accept", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  assertDevBranchDatabase("chat-rooms browser");
  const prevSetting = await prisma.systemSetting.findUnique({
    where: { key: "chatEnabled" },
    select: { value: true },
  });
  await prisma.systemSetting.upsert({
    where: { key: "chatEnabled" },
    update: { value: "true" },
    create: { key: "chatEnabled", value: "true" },
  });

  const users: string[] = [];
  const convIds: string[] = [];

  try {
    const [inviter, friend, stranger] = await Promise.all([
      createUser("Inviter"),
      createUser("InvitedFriend"),
      createUser("LeakStranger"),
    ]);
    users.push(inviter.id, friend.id, stranger.id);
    await makeFriends(inviter.id, friend.id);

    const room = await createRoom(inviter.id, {
      name: "Secret Atlas Circle",
      emoji: "🧭",
      accentColor: "main",
    });
    convIds.push(room.id);

    const link = await createLinkInvite(inviter.id, {
      roomId: room.id,
      inviteeId: friend.id,
    });

    // Stranger visits /chat/invite/[token] -> generic unavailable, room name not leaked
    const sSession = await loginContext(
      browser,
      stranger.email,
      stranger.password,
    );
    try {
      await sSession.page.goto(`/chat/invite/${link.token}`, {
        waitUntil: "domcontentloaded",
      });
      await expect(
        sSession.page.getByTestId("invite-unavailable"),
      ).toBeVisible({ timeout: 15_000 });
      const bodyText = await sSession.page.locator("body").innerText();
      expect(bodyText).not.toContain("Secret Atlas Circle");
    } finally {
      await sSession.ctx.close();
    }

    // Friend visits /chat/invite/[token] -> sees room name & accepts
    const fSession = await loginContext(
      browser,
      friend.email,
      friend.password,
    );
    try {
      await fSession.page.goto(`/chat/invite/${link.token}`, {
        waitUntil: "domcontentloaded",
      });
      const card = fSession.page.getByTestId("invite-preview-card");
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card).toContainText("Secret Atlas Circle");

      const acceptResPromise = fSession.page.waitForResponse(
        (res) =>
          res.url().includes(`/api/chat/invites/link/${link.token}/respond`) &&
          res.request().method() === "POST",
      );
      await fSession.page.getByTestId("invite-accept-btn").click();
      const acceptRes = await acceptResPromise;
      expect(acceptRes.status()).toBe(200);

      const member = await prisma.conversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: room.id,
            userId: friend.id,
          },
        },
        select: { leftAt: true },
      });
      expect(member).not.toBeNull();
      expect(member?.leftAt).toBeNull();
    } finally {
      await fSession.ctx.close();
    }
  } finally {
    if (convIds.length > 0) {
      await prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    if (users.length > 0) {
      await prisma.rateLimit.deleteMany({
        where: {
          OR: users.map((id) => ({ key: { contains: id } })),
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: prevSetting?.value ?? "false" },
      create: { key: "chatEnabled", value: prevSetting?.value ?? "false" },
    });
  }
});
