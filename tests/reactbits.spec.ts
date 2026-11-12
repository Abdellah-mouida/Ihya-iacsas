import { expect, test } from "@playwright/test";
import { ensureTestUser, loginAs, TEST_ADMIN, assertDevBranchDatabase } from "./helpers/admin-auth";
import { prisma } from "../src/lib/prisma";

assertDevBranchDatabase("React Bits adoption proof");

test.describe("React Bits visible proof", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
  });

  test.afterAll(async () => {
    assertDevBranchDatabase("React Bits proof cleanup");
    const user = await prisma.user.findUnique({ where: { email: TEST_ADMIN.email }, select: { id: true } });
    if (user) await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email: TEST_ADMIN.email } });
  });

  test("every documented effect renders on its documented route", async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
    });
    for (const [route, markers] of [
      ["/", ["FoldText", "CountUp", "SpotlightCard"]],
      ["/gallery", ["TiltedCard"]],
      ["/events", ["AnimatedContent", "SpotlightCard"]],
      ["/login", ["BlurText"]],
      ["/signup", ["ShinyText"]],
    ] as const) {
      await page.goto(route);
      for (const marker of markers) {
        const proof = page.locator(`[data-rb="${marker}"]`).first();
        if (marker === "CountUp") {
          await page.evaluate(() => {
            const target = document.querySelector<HTMLElement>("#about [data-in-view-mount]");
            if (target) window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2);
          });
        }
        await expect(proof).toBeVisible();
        if (marker === "FoldText") await expect(page.locator("#home")).toHaveAttribute("data-fold-state", "ready", { timeout: 15_000 });
      }
      if (route === "/") {
        const hero = page.locator("#home");
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(hero).toHaveAttribute("data-fold-state", "ready", { timeout: 15_000 });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect(hero).toHaveAttribute("data-fold-paused", "true");
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(hero).toHaveAttribute("data-fold-paused", "false");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect.poll(() => hero.locator("[data-fold-word]").first().evaluate((word) => (word as HTMLElement).style.transform)).toBe("");
        await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
        await hero.locator("[data-fold-word]").first().hover();
        await page.waitForTimeout(250);
        await expect.poll(() => hero.locator("[data-fold-word]").first().evaluate((word) => (word as HTMLElement).style.transform)).toBe("");
      }
    }

    await loginAs(page, TEST_ADMIN, "/profile");
    await expect(page.locator('[data-rb="ProfileCard"]')).toBeVisible({ timeout: 30_000 });
    await page.goto("/settings");
    await expect(page.locator('[data-rb="AnimatedContent"]')).toBeVisible();
    await page.goto("/admin");
    await expect(page.locator('[data-rb="MagicBento"]')).toBeVisible();
  });

  test("keeps the FoldText hero static on a low-power device", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 2 });
      Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 2 });
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator('[data-rb="FoldText"]')).toBeVisible();
      await expect(page.locator("#home")).not.toHaveAttribute("data-fold-state");
    } finally {
      await context.close();
    }
  });
});
