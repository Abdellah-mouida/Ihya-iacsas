import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import {
  signLocalRealtimeToken,
  verifyLocalRealtimeToken,
  localSseTransport,
  subscribeLocalChannels,
  publishLocalEvent,
} from "../src/lib/chat/realtime/local-sse";
import { ablyTransport } from "../src/lib/chat/realtime/ably";
import {
  canUserAccessConversation,
  getAuthorizedChannelsForUser,
} from "../src/lib/chat/realtime/channels";
import {
  conversationChannel,
  presenceChannel,
  userChannel,
} from "../src/lib/chat/realtime/types";
import {
  acceptFriendRequest,
  blockUser,
  canonicalPairKey,
  sendFriendRequest,
} from "../src/lib/chat/friends";

async function createUser(label: string, termsAccepted = true) {
  assertDevBranchDatabase("chat-realtime test");
  const suffix = randomBytes(6).toString("hex");
  return prisma.user.create({
    data: {
      email: `rt.${label.toLowerCase()}.${suffix}@example.test`,
      name: `RT_${label}_${suffix}`,
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      onboardingCompletedAt: new Date(),
      chatTermsAcceptedAt: termsAccepted ? new Date() : null,
      showOnlineStatus: true,
      role: "USER",
      sessionVersion: 1,
    },
    select: { id: true },
  });
}

test.describe("12-T3: RealtimeTransport, Scoped 10m Tokens, SSE Pub/Sub & Membership Revocation", () => {
  test.describe.configure({ timeout: 90_000 });

  test("local token signing, tampering, expiry, and Ably capability scoping", async () => {
    const token = await localSseTransport.issueClientToken({
      userId: "user_abc",
      channels: ["user:user_abc", "conv:room_1", "presence:global"],
      showOnlineStatus: true,
      ttlMs: 10 * 60 * 1000,
    });

    expect(token.provider).toBe("local");
    expect(token.localToken).toBeTruthy();
    expect(token.expiresAt - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    expect(token.expiresAt - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000 + 500);

    const verified = verifyLocalRealtimeToken(token.localToken!);
    expect(verified?.sub).toBe("user_abc");
    expect(verified?.ch).toEqual(["user:user_abc", "conv:room_1", "presence:global"]);

    // Tampered token rejected
    const tampered = `${token.localToken!.slice(0, -3)}xxx`;
    expect(verifyLocalRealtimeToken(tampered)).toBeNull();

    // Expired token rejected
    const expired = signLocalRealtimeToken({
      sub: "user_abc",
      ch: ["user:user_abc"],
      exp: Date.now() - 1000,
      onl: true,
    });
    expect(verifyLocalRealtimeToken(expired)).toBeNull();

    // Ably capability check (with synthetic key, no network call needed for createTokenRequest)
    const prevKey = process.env.ABLY_API_KEY;
    try {
      process.env.ABLY_API_KEY = "appId1.keyId1:superSecretKeyForSigningTest123";
      const ablyTok = await ablyTransport.issueClientToken({
        userId: "user_abc",
        channels: ["user:user_abc", "conv:room_1", "presence:global"],
        showOnlineStatus: false,
        ttlMs: 10 * 60 * 1000,
      });
      expect(ablyTok.provider).toBe("ably");
      const req = ablyTok.ablyTokenRequest as {
        clientId: string;
        ttl: number;
        capability: string;
        mac: string;
      };
      expect(req.clientId).toBe("user_abc");
      expect(req.ttl).toBe(600_000);
      expect(req.mac).toBeTruthy();
      const cap = JSON.parse(req.capability) as Record<string, string[]>;
      expect(cap["user:user_abc"]).toEqual(["subscribe"]);
      expect(cap["conv:room_1"]).toEqual(["subscribe"]);
      // showOnlineStatus = false -> subscribe only, no presence publish capability
      expect(cap["presence:global"]).toEqual(["subscribe"]);
    } finally {
      if (prevKey === undefined) delete process.env.ABLY_API_KEY;
      else process.env.ABLY_API_KEY = prevKey;
    }
  });

  test("local SSE pub/sub delivers ID-only events to authorized subscribers only", async () => {
    const received: unknown[] = [];
    const unsub = subscribeLocalChannels([conversationChannel("c1")], (env) => {
      received.push(env);
    });

    publishLocalEvent(conversationChannel("c2"), {
      type: "message.created",
      conversationId: "c2",
      messageId: "m_other",
      senderId: "u2",
      createdAt: new Date().toISOString(),
    });
    publishLocalEvent(conversationChannel("c1"), {
      type: "message.created",
      conversationId: "c1",
      messageId: "m_1",
      senderId: "u1",
      createdAt: new Date().toISOString(),
    });

    unsub();
    expect(received).toHaveLength(1);
    const serialized = JSON.stringify(received[0]);
    expect(serialized).toContain("m_1");
    expect(serialized).not.toContain("ciphertext");
    expect(serialized).not.toContain("plaintext");
  });

  test("channel authorization enforces terms, room leave, DM friendship & blocking", async () => {
    assertDevBranchDatabase("chat-realtime authz test");
    const [u1, u2, uNoTerms] = await Promise.all([
      createUser("U1", true),
      createUser("U2", true),
      createUser("NoTerms", false),
    ]);

    const pair = canonicalPairKey(u1.id, u2.id);
    const dmConv = await prisma.conversation.create({
      data: {
        type: "DM",
        dmPairKey: pair,
        members: {
          create: [{ userId: u1.id }, { userId: u2.id }],
        },
      },
      select: { id: true },
    });

    const roomConv = await prisma.conversation.create({
      data: {
        type: "ROOM",
        name: "Test Room",
        ownerId: u1.id,
        members: {
          create: [
            { userId: u1.id, role: "OWNER" },
            { userId: u2.id, role: "MEMBER" },
          ],
        },
      },
      select: { id: true },
    });

    try {
      // Unaccepted terms user only gets personal channel, no public/presence
      const noTermsAuthz = await getAuthorizedChannelsForUser(uNoTerms.id);
      expect(noTermsAuthz.termsAccepted).toBe(false);
      expect(noTermsAuthz.channels).toEqual([userChannel(uNoTerms.id)]);
      expect(noTermsAuthz.channels).not.toContain(presenceChannel());

      // Before friendship accepted: u1 has room + public + presence, NOT dmConv
      const beforeFriend = await getAuthorizedChannelsForUser(u1.id);
      expect(beforeFriend.channels).toContain(conversationChannel(roomConv.id));
      expect(beforeFriend.channels).not.toContain(conversationChannel(dmConv.id));

      // Accept friendship -> dmConv granted
      await sendFriendRequest(u1.id, u2.id);
      await acceptFriendRequest(u2.id, u1.id);
      const afterFriend = await getAuthorizedChannelsForUser(u1.id);
      expect(afterFriend.channels).toContain(conversationChannel(dmConv.id));
      expect((await canUserAccessConversation(u1.id, dmConv.id)).ok).toBe(true);

      // u2 leaves room -> room channel revoked
      await prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId: roomConv.id, userId: u2.id } },
        data: { leftAt: new Date() },
      });
      expect((await canUserAccessConversation(u2.id, roomConv.id)).ok).toBe(false);
      const u2AfterLeave = await getAuthorizedChannelsForUser(u2.id);
      expect(u2AfterLeave.channels).not.toContain(conversationChannel(roomConv.id));

      // u1 blocks u2 -> dmConv revoked for both
      await blockUser(u1.id, u2.id);
      expect((await canUserAccessConversation(u1.id, dmConv.id)).ok).toBe(false);
      expect((await canUserAccessConversation(u2.id, dmConv.id)).ok).toBe(false);
    } finally {
      await prisma.conversation.deleteMany({
        where: { id: { in: [dmConv.id, roomConv.id] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [u1.id, u2.id, uNoTerms.id] } },
      });
    }
  });
});
