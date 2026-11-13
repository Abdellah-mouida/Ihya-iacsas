import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import {
  acceptFriendRequest,
  areFriends,
  blockUser,
  cancelFriendRequest,
  ChatServiceError,
  declineFriendRequest,
  getAcceptedFriendCount,
  getPublicProfile,
  searchUsersByNamePrefix,
  sendFriendRequest,
  unblockUser,
  unfriendUser,
} from "../src/lib/chat/friends";

const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3000";

async function createOnboardedUser(label: string) {
  assertDevBranchDatabase("chat-friends test setup");
  const suffix = randomBytes(8).toString("hex");
  const email = `friends.${label.toLowerCase()}.${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const user = await prisma.user.create({
    data: {
      email,
      name: `Friend_${label}_${suffix.slice(0, 6)}`,
      city: "Rabat",
      age: 23,
      bio: `Bio for ${label}`,
      passwordHash: await bcrypt.hash(password, 10),
      emailVerified: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      onboardingCompletedAt: new Date(),
      role: "USER",
      sessionVersion: 1,
    },
    select: { id: true, email: true, name: true },
  });
  return { ...user, password };
}

test.describe("12-T2: Friends, Public Profile /u/[id], Search & Privacy Settings", () => {
  test.describe.configure({ timeout: 90_000 });

  test("state transitions, mutual auto-accept, duplicate prevention, block & privacy projections", async () => {
    assertDevBranchDatabase("chat-friends service tests");
    const [a, b, c] = await Promise.all([
      createOnboardedUser("Alpha"),
      createOnboardedUser("Beta"),
      createOnboardedUser("Gamma"),
    ]);

    try {
      // Self request rejected
      await expect(sendFriendRequest(a.id, a.id, { bypassRateLimit: true })).rejects.toMatchObject({
        status: 400,
      });

      // A sends -> duplicate send is idempotent (only 1 row) -> A cancels
      const r1 = await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
      expect(r1.status).toBe("PENDING");
      expect(r1.alreadyExists).toBe(false);

      const rDup = await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
      expect(rDup.status).toBe("PENDING");
      expect(rDup.alreadyExists).toBe(true);
      expect(rDup.friendshipId).toBe(r1.friendshipId);

      // Requester cannot accept their own request
      await expect(acceptFriendRequest(a.id, b.id)).rejects.toBeInstanceOf(ChatServiceError);

      await cancelFriendRequest(a.id, b.id);
      expect(await areFriends(a.id, b.id)).toBe(false);

      // A sends -> B declines -> A can re-send -> B accepts
      await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
      const dec = await declineFriendRequest(b.id, a.id);
      expect(dec.status).toBe("DECLINED");

      await sendFriendRequest(a.id, b.id, { bypassRateLimit: true });
      const acc = await acceptFriendRequest(b.id, a.id);
      expect(acc.status).toBe("ACCEPTED");
      expect(await areFriends(a.id, b.id)).toBe(true);
      expect(await getAcceptedFriendCount(a.id)).toBe(1);
      expect(await getAcceptedFriendCount(b.id)).toBe(1);

      // Unfriend
      await unfriendUser(a.id, b.id);
      expect(await areFriends(a.id, b.id)).toBe(false);
      expect(await getAcceptedFriendCount(a.id)).toBe(0);

      // Mutual request: A sends to C, then C sends to A -> auto-accepted!
      await sendFriendRequest(a.id, c.id, { bypassRateLimit: true });
      const mutual = await sendFriendRequest(c.id, a.id, { bypassRateLimit: true });
      expect(mutual.status).toBe("ACCEPTED");
      expect(mutual.autoAccepted).toBe(true);
      expect(await areFriends(a.id, c.id)).toBe(true);

      // Block clears friendship and prevents requests in both directions
      await blockUser(a.id, c.id);
      expect(await areFriends(a.id, c.id)).toBe(false);
      await expect(sendFriendRequest(c.id, a.id, { bypassRateLimit: true })).rejects.toMatchObject({
        status: 403,
      });
      await expect(sendFriendRequest(a.id, c.id, { bypassRateLimit: true })).rejects.toMatchObject({
        status: 403,
      });

      const blockedView = await getPublicProfile(c.id, a.id);
      expect(blockedView?.relationship).toBe("BLOCKED_BY_THEM");
      expect(blockedView?.friendCount).toBeNull();
      expect(blockedView?.bio).toBeNull();

      await unblockUser(a.id, c.id);

      // Search: < 3 chars rejected; >= 3 prefix match excludes self and never leaks email/age
      await expect(searchUsersByNamePrefix(a.id, "Fr", { bypassRateLimit: true })).rejects.toMatchObject({
        status: 400,
      });
      const matches = await searchUsersByNamePrefix(a.id, b.name!.slice(0, 10), {
        bypassRateLimit: true,
      });
      expect(matches.some((m) => m.id === b.id)).toBe(true);
      expect(matches.some((m) => m.id === a.id)).toBe(false);
      const bMatch = matches.find((m) => m.id === b.id)! as Record<string, unknown>;
      expect(bMatch.email).toBeUndefined();
      expect(bMatch.age).toBeUndefined();

      // Privacy settings respected on public profile
      await prisma.user.update({
        where: { id: b.id },
        data: { showFriendCount: false, showOnlineStatus: false, friendRequestPolicy: "NOBODY" },
      });
      const pubB = await getPublicProfile(a.id, b.id);
      expect(pubB).not.toBeNull();
      expect(pubB!.friendCount).toBeNull();
      expect(pubB!.isOnline).toBeNull();
      expect(pubB!.canReceiveFriendRequest).toBe(false);
      expect((pubB as unknown as Record<string, unknown>).email).toBeUndefined();
      expect((pubB as unknown as Record<string, unknown>).age).toBeUndefined();

      await expect(sendFriendRequest(a.id, b.id, { bypassRateLimit: true })).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: [a.id, b.id, c.id] } } });
    }
  });

  test("UI flow: /u/[id] request + accept updates profile CountUp, privacy settings hide count, dark flag 404", async ({
    browser,
  }) => {
    assertDevBranchDatabase("chat-friends browser e2e");
    const [userA, userB] = await Promise.all([
      createOnboardedUser("UIA"),
      createOnboardedUser("UIB"),
    ]);

    const priorSetting = await prisma.systemSetting.findUnique({ where: { key: "chatEnabled" } });
    await prisma.systemSetting.upsert({
      where: { key: "chatEnabled" },
      update: { value: "true" },
      create: { key: "chatEnabled", value: "true" },
    });

    const ctxA = await browser.newContext({
      baseURL: BASE,
      viewport: { width: 1280, height: 800 },
    });
    const ctxB = await browser.newContext({
      baseURL: BASE,
      viewport: { width: 360, height: 800 },
    });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      // Login A
      await pageA.goto("/login?callbackUrl=/profile");
      await expect(pageA.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15_000 });
      await pageA.locator('[data-testid="login-email-input"]').fill(userA.email!);
      await pageA.locator('[data-testid="login-password-input"]').fill(userA.password);
      await pageA.locator('[data-testid="login-submit-btn"]').click();
      await expect(pageA).toHaveURL(/^https?:\/\/[^/]+\/profile(?:\?.*)?$/, { timeout: 25_000 });

      // Login B
      await pageB.goto("/login?callbackUrl=/profile");
      await expect(pageB.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15_000 });
      await pageB.locator('[data-testid="login-email-input"]').fill(userB.email!);
      await pageB.locator('[data-testid="login-password-input"]').fill(userB.password);
      await pageB.locator('[data-testid="login-submit-btn"]').click();
      await expect(pageB).toHaveURL(/^https?:\/\/[^/]+\/profile(?:\?.*)?$/, { timeout: 25_000 });

      // A visits B's public profile: no email/age leaked, Add friend works
      await pageA.goto(`/u/${userB.id}`);
      await expect(pageA.locator('[data-testid="public-profile-header-card"]')).toBeVisible();
      const bodyText = await pageA.locator("main").innerText();
      expect(bodyText).not.toContain(userB.email!);
      expect(bodyText).not.toContain("23 years");

      await pageA.locator('[data-testid="public-profile-add-friend"]').click();
      await expect(pageA.locator('[data-testid="public-profile-cancel-request"]')).toBeVisible({
        timeout: 15_000,
      });

      // B visits A's public profile on 360px phone, verifies zero horizontal overflow, accepts request
      await pageB.goto(`/u/${userA.id}`);
      await expect(pageB.locator('[data-testid="public-profile-accept-request"]')).toBeVisible({
        timeout: 15_000,
      });
      const overflow360 = await pageB.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow360).toBe(false);

      await pageB.locator('[data-testid="public-profile-accept-request"]').click();
      await expect(pageB.locator('[data-testid="public-profile-message-btn"]')).toBeVisible({
        timeout: 15_000,
      });
      await expect(pageB.locator('[data-testid="public-profile-friend-count"]')).toContainText("1");

      // Own /profile shows animated CountUp friend count = 1
      await pageB.goto("/profile");
      await expect(pageB.locator('[data-testid="profile-friend-count"]')).toContainText("1", {
        timeout: 15_000,
      });

      // B toggles showFriendCount off in Settings -> Privacy
      await pageB.goto("/settings?tab=privacy");
      await expect(pageB.locator('[data-testid="settings-chat-privacy-block"]')).toBeVisible({
        timeout: 15_000,
      });
      const countSwitch = pageB.locator('[data-testid="privacy-show-friend-count-toggle"]');
      await countSwitch.click();
      await expect(countSwitch).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });

      // A reloads B's public profile and no longer sees friend count
      await pageA.reload();
      await expect(pageA.locator('[data-testid="public-profile-friend-count"]')).toHaveCount(0);

      // Dark flag OFF -> /u/[id] hides profile (NotFound boundary) & API returns 404
      await prisma.systemSetting.update({
        where: { key: "chatEnabled" },
        data: { value: "false" },
      });
      await pageA.goto(`/u/${userB.id}`);
      await expect(pageA.locator('[data-testid="public-profile-header-card"]')).toHaveCount(0);
      const apiDisabled = await pageA.request.get("/api/chat/friends");
      expect(apiDisabled.status()).toBe(404);
    } finally {
      await ctxA.close();
      await ctxB.close();
      if (priorSetting) {
        await prisma.systemSetting.update({
          where: { key: "chatEnabled" },
          data: { value: priorSetting.value },
        });
      } else {
        await prisma.systemSetting.deleteMany({ where: { key: "chatEnabled" } });
      }
      await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    }
  });
});
