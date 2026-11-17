import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";
import {
  FRIEND_REQUEST_DAILY_LIMIT,
  USER_SEARCH_PER_MIN_LIMIT,
  sendFriendRequest,
  searchUsersByNamePrefix,
} from "../src/lib/chat/friends";

assertDevBranchDatabase("Security friends/search rate-limit regression test");

test.describe("IHY-SEC-004: friend request & user search rate limits", () => {
  test.setTimeout(60_000);

  test("rejects excess friend requests & searches with 429 RATE_LIMITED while allowing normal users", async ({
    browser,
    baseURL,
  }) => {
    const userA = await createSyntheticUser("RateLimit A");
    const userB = await createSyntheticUser("RateLimit B");
    const userC = await createSyntheticUser("RateLimit C");

    const now = new Date();
    await prisma.user.updateMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
      data: {
        onboardingCompletedAt: now,
        chatTermsAcceptedAt: now,
      },
    });
    const prevChatSetting = await prisma.systemSetting.findUnique({
      where: { key: "chatEnabled" },
    });
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "true" },
      create: { key: "chatEnabled", value: "true" },
    });

    const futureReset = new Date(Date.now() + 60_000);
    await prisma.rateLimit.upsert({
      where: { key: `friend-req:${userA.id}` },
      update: { count: FRIEND_REQUEST_DAILY_LIMIT, expiresAt: futureReset },
      create: {
        key: `friend-req:${userA.id}`,
        count: FRIEND_REQUEST_DAILY_LIMIT,
        expiresAt: futureReset,
      },
    });
    await prisma.rateLimit.upsert({
      where: { key: `user-search:${userA.id}` },
      update: { count: USER_SEARCH_PER_MIN_LIMIT, expiresAt: futureReset },
      create: {
        key: `user-search:${userA.id}`,
        count: USER_SEARCH_PER_MIN_LIMIT,
        expiresAt: futureReset,
      },
    });

    try {
      await expect(sendFriendRequest(userA.id, userC.id)).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });

      await expect(searchUsersByNamePrefix(userA.id, "Rate")).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });

      const ctxA = await browser.newContext({ baseURL });
      const ctxB = await browser.newContext({ baseURL });
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      await pageA.goto("/login");
      await pageA.fill('[data-testid="login-email-input"]', userA.email);
      await pageA.fill('[data-testid="login-password-input"]', userA.password);
      await pageA.click('[data-testid="login-submit-btn"]');
      await pageA.waitForURL((u) => !u.pathname.startsWith("/login"), {
        timeout: 20_000,
      });

      await pageB.goto("/login");
      await pageB.fill('[data-testid="login-email-input"]', userB.email);
      await pageB.fill('[data-testid="login-password-input"]', userB.password);
      await pageB.click('[data-testid="login-submit-btn"]');
      await pageB.waitForURL((u) => !u.pathname.startsWith("/login"), {
        timeout: 20_000,
      });

      const reqA = await pageA.request.post("/api/chat/friends", {
        data: { action: "send", targetUserId: userC.id },
      });
      expect(reqA.status()).toBe(429);

      const searchA = await pageA.request.get("/api/chat/users/search?q=RateLimit");
      expect(searchA.status()).toBe(429);

      const searchB = await pageB.request.get("/api/chat/users/search?q=RateLimit");
      expect(searchB.status()).toBe(200);

      const reqB = await pageB.request.post("/api/chat/friends", {
        data: { action: "send", targetUserId: userC.id },
      });
      expect(reqB.status()).toBe(200);

      await ctxA.close();
      await ctxB.close();
    } finally {
      if (prevChatSetting) {
        await prisma.systemSetting.update({
          where: { key: "chatEnabled" },
          data: { value: prevChatSetting.value },
        });
      }
      await prisma.notification.deleteMany({
        where: { userId: { in: [userA.id, userB.id, userC.id] } },
      });
      await prisma.rateLimit.deleteMany({
        where: {
          key: {
            in: [
              `friend-req:${userA.id}`,
              `user-search:${userA.id}`,
              `friend-req:${userB.id}`,
              `user-search:${userB.id}`,
            ],
          },
        },
      });
      await prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: { in: [userA.id, userB.id, userC.id] } },
            { addresseeId: { in: [userA.id, userB.id, userC.id] } },
          ],
        },
      });
      await removeSyntheticUser(userA.id);
      await removeSyntheticUser(userB.id);
      await removeSyntheticUser(userC.id);
    }
  });
});
