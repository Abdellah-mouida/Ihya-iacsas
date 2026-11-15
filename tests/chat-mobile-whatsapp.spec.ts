import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase("Chat WhatsApp mobile UX tests");

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

async function createChatUser(locale: "ar" | "en", theme = "dark") {
  const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const email = `chat-wa-${suffix}@example.test`;
  const password = `Pw!${crypto.randomBytes(8).toString("hex")}A1`;
  const passwordHash = await bcrypt.hash(password, 6);
  const name = `WA User ${suffix.slice(-4)}`;
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      chatTermsAcceptedAt: new Date(),
      locale,
      theme,
    },
    select: { id: true },
  });
  return { id: user.id, email, password, name };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login?callbackUrl=%2Fchat`);
  await page.locator('[data-testid="login-email-input"]').fill(email);
  await page.locator('[data-testid="login-password-input"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25_000 });
  if (!page.url().includes("/chat")) {
    await page.goto(`${BASE}/chat`);
  }
  await expect(page.locator('[data-testid="chat-workspace"]')).toBeVisible({ timeout: 20_000 });
}

test.describe("WhatsApp-style phone chat UX", () => {
  test.setTimeout(90_000);

  test("360px phone layout, 44px tap targets, blur(12px) container, search, and visualViewport shrink", async ({
    browser,
  }) => {
    const prevChatEnabled = await setChatEnabled(true);
    const user = await createChatUser("en", "amoled");

    try {
      const ctx = await browser.newContext({
        viewport: { width: 360, height: 740 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await ctx.newPage();

      await page.addInitScript(() => {
        const listeners: Record<string, Array<() => void>> = { resize: [], scroll: [] };
        let height = 740;
        const fakeVv = {
          get width() {
            return 360;
          },
          get height() {
            return height;
          },
          get offsetTop() {
            return 0;
          },
          get offsetLeft() {
            return 0;
          },
          get pageTop() {
            return 0;
          },
          get pageLeft() {
            return 0;
          },
          get scale() {
            return 1;
          },
          addEventListener(type: string, cb: () => void) {
            listeners[type] = listeners[type] || [];
            listeners[type].push(cb);
          },
          removeEventListener(type: string, cb: () => void) {
            listeners[type] = (listeners[type] || []).filter((fn) => fn !== cb);
          },
        };
        Object.defineProperty(window, "visualViewport", {
          configurable: true,
          get: () => fakeVv,
        });
        (window as unknown as { __setTestViewportHeight?: (h: number) => void }).__setTestViewportHeight = (
          nextH: number,
        ) => {
          height = nextH;
          for (const cb of listeners.resize || []) cb();
        };
      });

      await signIn(page, user.email, user.password);

      // On mobile list screen, open the public space conversation
      await page.locator('[data-testid="chat-conv-public"]').click();
      await expect(page.locator('[data-testid="chat-conversation-pane"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-sidebar"]')).toBeHidden();

      // Header + composer visible, zero horizontal overflow at 360px
      const header = page.locator('[data-testid="chat-conv-header"]');
      const composer = page.locator('[data-testid="chat-composer-footer"]');
      await expect(header).toBeVisible();
      await expect(composer).toBeVisible();

      const overflow360 = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow360).toBe(false);

      // Tap targets >= 44px
      const tapRects = await page.evaluate(() => {
        const ids = [
          "chat-mobile-back-btn",
          "chat-conv-search-btn",
          "chat-conv-menu-btn",
          "chat-emoji-btn",
          "chat-composer-input",
        ];
        return ids.map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          const r = el?.getBoundingClientRect();
          return { id, width: r?.width ?? 0, height: r?.height ?? 0 };
        });
      });
      for (const rect of tapRects) {
        expect(rect.height, `${rect.id} height`).toBeGreaterThanOrEqual(43.5);
        expect(rect.width, `${rect.id} width`).toBeGreaterThanOrEqual(43.5);
      }

      // Single frosted glass surface (blur(12px)) when not low-power, and fallback when data-perf="low"
      await page.evaluate(() => {
        document.documentElement.removeAttribute("data-perf");
      });
      const surfaceBlur = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="chat-surface"]');
        const cs = el ? getComputedStyle(el) : null;
        return cs ? cs.backdropFilter || (cs as unknown as Record<string, string>).webkitBackdropFilter : "";
      });
      expect(surfaceBlur).toContain("12px");

      await page.evaluate(() => {
        document.documentElement.setAttribute("data-perf", "low");
      });
      const lowPerfBlur = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="chat-surface"]');
        return el ? getComputedStyle(el).backdropFilter : "";
      });
      expect(lowPerfBlur).toBe("none");
      await page.evaluate(() => {
        document.documentElement.removeAttribute("data-perf");
      });

      // Send a message, verify bubble bottom-end timestamp inside bubble, and search highlights it
      const uniqueToken = `WA-${crypto.randomBytes(3).toString("hex")}`;
      await page.locator('[data-testid="chat-composer-input"]').fill(`Salam ${uniqueToken}`);
      await page.locator('[data-testid="chat-send-btn"]').click();
      await expect(page.getByText(`Salam ${uniqueToken}`)).toBeVisible({ timeout: 10_000 });

      const metaInsideBubble = await page.evaluate((tok) => {
        const p = Array.from(document.querySelectorAll("p")).find((el) =>
          el.textContent?.includes(tok),
        );
        const bubble = p?.parentElement;
        return Boolean(bubble?.querySelector('[data-testid^="msg-bubble-meta-"]'));
      }, uniqueToken);
      expect(metaInsideBubble).toBe(true);

      // Header menu opens with Mute + Search
      await page.locator('[data-testid="chat-conv-menu-btn"]').click();
      await expect(page.locator('[data-testid="chat-menu-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="chat-mute-toggle-btn"]')).toBeVisible();
      await page.locator('[data-testid="chat-menu-search"]').click();
      await expect(page.locator('[data-testid="chat-conv-search-bar"]')).toBeVisible();
      await page.locator('[data-testid="chat-conv-search-input"]').fill(uniqueToken);
      await expect(page.locator("mark", { hasText: uniqueToken })).toBeVisible();

      // Shrink visualViewport to simulate soft keyboard -> header and composer remain within [0, 380]
      await page.evaluate(() => {
        (window as unknown as { __setTestViewportHeight: (h: number) => void }).__setTestViewportHeight(
          380,
        );
      });
      await page.waitForTimeout(100);
      const vvBoxes = await page.evaluate(() => {
        const h = document.querySelector('[data-testid="chat-conv-header"]')?.getBoundingClientRect();
        const c = document.querySelector('[data-testid="chat-composer-footer"]')?.getBoundingClientRect();
        return {
          headerTop: h?.top ?? -1,
          composerBottom: c?.bottom ?? 9999,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(vvBoxes.overflow).toBe(false);
      expect(vvBoxes.headerTop).toBeGreaterThanOrEqual(0);
      expect(vvBoxes.composerBottom).toBeLessThanOrEqual(382);

      // Check 320px and 390px viewports across themes & ar/en locales have zero horizontal overflow
      for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 700 });
        await page.evaluate(() => {
          (window as unknown as { __setTestViewportHeight: (h: number) => void }).__setTestViewportHeight(
            700,
          );
        });
        for (const [theme, dark, dir, lang] of [
          ["light", false, "rtl", "ar"],
          ["dark", true, "ltr", "en"],
          ["sunset", true, "rtl", "ar"],
          ["amoled", true, "ltr", "en"],
        ] as const) {
          await page.evaluate(
            ({ t, isDark, d, l }) => {
              document.documentElement.setAttribute("data-theme", t);
              document.documentElement.classList.toggle("dark", isDark);
              document.documentElement.setAttribute("dir", d);
              document.documentElement.setAttribute("lang", l);
            },
            { t: theme, isDark: dark, d: dir, l: lang },
          );
          await page.waitForTimeout(30);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(overflow, `overflow at ${width}px (${theme}/${lang})`).toBe(false);
        }
      }

      await ctx.close();
    } finally {
      await prisma.message.deleteMany({ where: { senderId: user.id } });
      await prisma.conversationMember.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
      await restoreChatEnabled(prevChatEnabled);
    }
  });
});
