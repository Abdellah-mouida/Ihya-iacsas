import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase, loginAs } from "./helpers/admin-auth";

async function expectSinglePageTexture(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="site-atmosphere"]')).toBeAttached();
  await expect(page.locator('[data-testid="site-atmosphere-pattern"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="page-texture-layer"]')).toHaveCount(0);
  await expect(page.locator(".pattern-islamic")).toHaveCount(0);
}

test.describe("One global texture per route family", () => {
  test.setTimeout(300_000);

  test("public, member, booking, and admin routes share one page texture", async ({ page }) => {
    assertDevBranchDatabase("Single texture route family test");

    const suffix = randomBytes(16).toString("hex");
    const password = randomBytes(32).toString("base64url");
    const passwordHash = await bcrypt.hash(password, 12);
    const completeAdmin = await prisma.user.create({
      data: {
        email: `texture-admin-${suffix}@example.test`,
        name: "Synthetic Texture Admin",
        passwordHash,
        emailVerified: new Date(),
        onboardingCompletedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        role: "ADMIN",
      },
      select: { id: true, email: true },
    });
    try {
      for (const route of ["/", "/events", "/gallery", "/login", "/signup"]) {
        await expectSinglePageTexture(page, route);
      }

      await loginAs(page, { email: completeAdmin.email!, password, role: "ADMIN" }, "/profile");
      for (const route of [
        "/profile",
        "/admin",
        "/book",
        "/events/majlis-ihyaa/book",
        "/events/texture-test-event/book",
      ]) {
        await expectSinglePageTexture(page, route);
      }

    } finally {
      await prisma.user.deleteMany({ where: { id: completeAdmin.id } });
    }
  });
});
