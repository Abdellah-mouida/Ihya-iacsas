import crypto from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase();

const prisma = new PrismaClient();
const BASE = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3001";

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

async function createTestUser(label: string, withTerms = false) {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const email = `chat-ui-${label.toLowerCase()}-${suffix}@example.test`;
  const password = `Pw!${crypto.randomBytes(8).toString("hex")}A1`;
  const passwordHash = await bcrypt.hash(password, 6);
  const displayName = `Chat UI ${label} ${suffix.slice(-4)}`;
  const user = await prisma.user.create({
    data: {
      email,
      name: displayName,
      passwordHash,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      chatTermsAcceptedAt: withTerms ? new Date() : null,
      showOnlineStatus: true,
      showFriendCount: true,
      locale: "ar",
      theme: "light",
    },
    select: { id: true },
  });
  return { id: user.id, email, name: displayName, password };
}

async function cleanupTestUsers(userIds: string[]) {
  if (userIds.length === 0) return;
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
        { dmPairKey: { contains: userIds[0] } },
        ...(userIds[1] ? [{ dmPairKey: { contains: userIds[1] } }] : []),
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

async function signIn(browser: Browser, email: string, password: string, viewport = { width: 1280, height: 820 }) {
  const context = await browser.newContext({ baseURL: BASE, viewport });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/login?callbackUrl=/chat");
  await expect(page.locator('[data-testid="login-view"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/chat(?:\?.*)?$/, { timeout: 25_000 });
  return { context, page, errors };
}

test.describe("12-T6: Chat Workspace UI, React Bits, Responsive & Realtime", () => {
  test.describe.configure({ timeout: 240_000 });

  test("guidelines gate, React Bits markers, realtime DM/typing/seen, 320px mobile 2-pane & themes", async ({ browser }) => {
    const prevEnabled = await setChatEnabled(true);
    const createdIds: string[] = [];

    try {
      const userA = await createTestUser("Alpha", false);
      const userB = await createTestUser("Beta", true);
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

      const aSession = await signIn(browser, userA.email, userA.password, { width: 1280, height: 820 });
      const bSession = await signIn(browser, userB.email, userB.password, { width: 320, height: 680 });

      try {
        const pageA: Page = aSession.page;
        const pageB: Page = bSession.page;

        await expect(pageA.locator('[data-testid="chat-terms-gate"]')).toBeVisible({ timeout: 15_000 });
        await pageA.locator('[data-testid="chat-terms-accept-btn"]').click();
        await expect(pageA.locator('[data-testid="chat-workspace"]')).toBeVisible({ timeout: 15_000 });

        await expect(pageA.locator('nav a[href="/chat"][aria-current="page"]')).toBeVisible();
        await expect(pageA.locator('[data-rb="ShinyText"]').first()).toBeVisible();
        await expect(pageA.locator('[data-rb="ClickSpark"]').first()).toBeVisible();

        await pageA.locator('[data-testid="chat-tab-friends"]').click();
        await expect(pageA.locator('[data-rb="AnimatedList"]').first()).toBeVisible();
        await pageA.locator(`[data-testid="open-dm-${userB.id}"]`).click();
        await expect(pageA.locator('[data-testid="chat-conversation-pane"] header')).toContainText(
          userB.name,
          { timeout: 15_000 },
        );
        await expect(pageA.locator('[data-testid="chat-composer-input"]')).toBeVisible();

        await expect(pageB.locator('[data-testid="chat-sidebar"]')).toBeVisible({ timeout: 15_000 });
        const hasOverflowB = await pageB.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        );
        expect(hasOverflowB).toBe(false);

        await pageB.locator('[data-testid="chat-tab-friends"]').click();
        await pageB.locator(`[data-testid="open-dm-${userA.id}"]`).click();
        await expect(pageB.locator('[data-testid="chat-mobile-back-btn"]')).toBeVisible({
          timeout: 10_000,
        });

        await pageB.locator('[data-testid="chat-composer-input"]').fill("Salam from 320px phone!");
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
          pageA.locator('[data-testid="chat-messages-scroll"]').getByText("Salam from 320px phone!"),
        ).toBeVisible({ timeout: 6_000 });

        await pageA.locator('[data-testid="chat-composer-input"]').type("Typing");
        await expect(pageB.locator('[data-testid="chat-typing-indicator"]')).toBeVisible({
          timeout: 8_000,
        });

        await pageA.locator('[data-testid="chat-composer-input"]').fill("Marhaban from desktop");
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
        await expect(
          pageB.locator('[data-testid="chat-messages-scroll"]').getByText("Marhaban from desktop"),
        ).toBeVisible({ timeout: 6_000 });
        await expect(pageA.locator('[data-testid^="msg-receipt-"]').first()).toBeVisible({
          timeout: 8_000,
        });

        const mobileOverflow = await pageB.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(mobileOverflow).toBe(true);

        await pageB.locator('[data-testid="chat-mobile-back-btn"]').click();
        await expect(pageB.locator('[data-testid="chat-sidebar"]')).toBeVisible();

        const desktopOverflow = await pageA.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        );
        expect(desktopOverflow).toBe(true);

        await pageA.evaluate(() => {
          document.documentElement.setAttribute("data-theme", "amoled");
          document.documentElement.classList.add("dark");
          document.documentElement.setAttribute("lang", "en");
          document.documentElement.setAttribute("dir", "ltr");
        });
        await expect
          .poll(
            () =>
              pageA.evaluate(() => getComputedStyle(document.body).backgroundColor),
            { timeout: 3_000 },
          )
          .toMatch(/^(rgb\(0,\s*0,\s*0\)|oklab\(0\s+0\s+0\)|lab\(0\s+0\s+0\))$/);

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
