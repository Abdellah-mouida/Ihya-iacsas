import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { signApiAccessToken } from "../src/lib/api/v1/tokens";
import { canonicalPairKey } from "../src/lib/chat/friends";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase("Mobile API T1 E2E tests");

test.describe("16-T1: Mobile API & App Link Endpoints", () => {
  const createdUserIds: string[] = [];
  let dmConversationId: string | null = null;

  test.afterAll(async () => {
    if (dmConversationId) {
      await prisma.message
        .deleteMany({ where: { conversationId: dmConversationId } })
        .catch(() => {});
      await prisma.conversationMember
        .deleteMany({ where: { conversationId: dmConversationId } })
        .catch(() => {});
      await prisma.conversation
        .deleteMany({ where: { id: dmConversationId } })
        .catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.friendship
        .deleteMany({
          where: {
            OR: [
              { requesterId: { in: createdUserIds } },
              { addresseeId: { in: createdUserIds } },
            ],
          },
        })
        .catch(() => {});
      await prisma.apiRefreshToken
        .deleteMany({ where: { session: { userId: { in: createdUserIds } } } })
        .catch(() => {});
      await prisma.apiSession
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => {});
    }
  });

  test("serves .well-known app links and v1 chat key, delivered, and wire endpoints", async ({
    request,
  }) => {
    test.setTimeout(180_000);
    const assetLinksRes = await request.get("/.well-known/assetlinks.json");
    expect(assetLinksRes.status()).toBe(200);
    expect(assetLinksRes.headers()["content-type"]).toContain("application/json");
    const assetLinks = await assetLinksRes.json();
    expect(Array.isArray(assetLinks)).toBe(true);
    expect(assetLinks[0]?.target?.namespace).toBe("android_app");
    expect(Array.isArray(assetLinks[0]?.target?.sha256_cert_fingerprints)).toBe(true);

    const aasaRes = await request.get("/.well-known/apple-app-site-association");
    expect(aasaRes.status()).toBe(200);
    expect(aasaRes.headers()["content-type"]).toContain("application/json");
    const aasa = await aasaRes.json();
    expect(Array.isArray(aasa?.applinks?.details)).toBe(true);
    expect(aasa.applinks.details[0]?.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ "/": "/chat/invite/*" }),
      ]),
    );

    const now = new Date();
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const makeUserWithToken = async (tag: string) => {
      const email = `mobile-t1-${tag}-${randomUUID()}@example.test`;
      const u = await prisma.user.create({
        data: {
          email,
          name: `Mobile T1 ${tag}`,
          emailVerified: now,
          city: "Casablanca",
          age: 22,
          termsAcceptedAt: now,
          termsVersion: "2026-10-12",
          onboardingCompletedAt: now,
          chatTermsAcceptedAt: now,
        },
        select: { id: true, role: true, sessionVersion: true },
      });
      createdUserIds.push(u.id);
      const sess = await prisma.apiSession.create({
        data: {
          userId: u.id,
          familyId: randomUUID(),
          platform: "android",
          deviceName: "Test Phone",
          expiresAt: sessionExpiry,
        },
        select: { id: true },
      });
      const { token } = await signApiAccessToken({
        userId: u.id,
        sessionId: sess.id,
        role: u.role,
        sessionVersion: u.sessionVersion,
      });
      return { id: u.id, token };
    };

    const [userA, userB, stranger] = await Promise.all([
      makeUserWithToken("a"),
      makeUserWithToken("b"),
      makeUserWithToken("stranger"),
    ]);

    const pairKey = canonicalPairKey(userA.id, userB.id);
    await prisma.friendship.create({
      data: {
        pairKey,
        requesterId: userA.id,
        addresseeId: userB.id,
        status: "ACCEPTED",
        respondedAt: now,
      },
    });

    const tokenA = userA.token;
    const tokenB = userB.token;
    const tokenStranger = stranger.token;

    const dmRes = await request.post("/api/v1/chat/conversations/dm", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { peerId: userB.id },
    });
    expect(dmRes.status()).toBe(200);
    const dmBody = await dmRes.json();
    dmConversationId = dmBody.conversation.id as string;

    const sendRes = await request.post("/api/v1/chat/messages", {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: {
        conversationId: dmConversationId,
        body: "Hello encrypted mobile v1",
      },
    });
    expect(sendRes.status()).toBe(201);

    const unauthKeyRes = await request.get(
      `/api/v1/chat/conversations/${dmConversationId}/key`,
    );
    expect(unauthKeyRes.status()).toBe(401);

    const strangerKeyRes = await request.get(
      `/api/v1/chat/conversations/${dmConversationId}/key`,
      { headers: { Authorization: `Bearer ${tokenStranger}` } },
    );
    expect(strangerKeyRes.status()).toBe(404);

    const keyRes = await request.get(
      `/api/v1/chat/conversations/${dmConversationId}/key`,
      { headers: { Authorization: `Bearer ${tokenB}` } },
    );
    expect(keyRes.status()).toBe(200);
    const keyJson = await keyRes.json();
    expect(keyJson.conversationId).toBe(dmConversationId);
    expect(keyJson.keyEpoch).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(keyJson.keys)).toBe(true);
    const activeKey = (
      keyJson.keys as Array<{
        keyVersion: number;
        keyEpoch: number;
        keyBase64: string;
      }>
    ).find(
      (k) =>
        k.keyVersion === keyJson.keyVersion && k.keyEpoch === keyJson.keyEpoch,
    );
    expect(typeof activeKey?.keyBase64).toBe("string");

    const deliveredRes = await request.post(
      `/api/v1/chat/conversations/${dmConversationId}/delivered`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { at: new Date().toISOString() },
      },
    );
    expect(deliveredRes.status()).toBe(200);
    const deliveredJson = await deliveredRes.json();
    expect(deliveredJson.ok).toBe(true);
    expect(typeof deliveredJson.lastDeliveredAt).toBe("string");

    const wireRes = await request.get(
      `/api/v1/chat/messages?conversationId=${dmConversationId}&wire=1`,
      { headers: { Authorization: `Bearer ${tokenB}` } },
    );
    expect(wireRes.status()).toBe(200);
    const wireJson = await wireRes.json();
    expect(Array.isArray(wireJson.wireMessages)).toBe(true);
    expect(wireJson.wireMessages.length).toBeGreaterThanOrEqual(1);
    expect(typeof wireJson.wireMessages[0].ciphertext).toBe("string");
    expect(wireJson.wireMessages[0].body).toBeUndefined();
    const wireKey = (
      wireJson.keyBundle?.keys as Array<{
        keyVersion: number;
        keyEpoch: number;
        keyBase64: string;
      }>
    )?.find(
      (k) =>
        k.keyVersion === wireJson.keyBundle?.keyVersion &&
        k.keyEpoch === wireJson.keyBundle?.keyEpoch,
    );
    expect(typeof wireKey?.keyBase64).toBe("string");
  });
});
