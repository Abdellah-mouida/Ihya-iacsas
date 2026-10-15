import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import nextConfig from "../next.config";
import { getInitials } from "../src/components/common/user-avatar";

const prisma = new PrismaClient();

test.describe("Task 4: Avatars & Google Profile Integration", () => {
  const timestamp = Date.now();
  const testEmail = `avatar.tester.${timestamp}@ihyaa.org`;
  const testPassword = "Password123#";
  let userId = "";

  test.beforeAll(async () => {
    // Create verified and onboarded test user
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(testPassword, 10);

    const user = await prisma.user.create({
      data: {
        name: "Abdellah Mouida",
        email: testEmail,
        passwordHash,
        emailVerified: new Date(),
        onboardingCompletedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: "2026-10-11",
        city: "Casablanca",
        age: 26,
        sessionVersion: 1,
      },
    });
    userId = user.id;
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });

  test("1. Initials extraction handles English, Arabic, single words, and email fallbacks", async () => {
    expect(getInitials("Abdellah Mouida")).toBe("AM");
    expect(getInitials("عبد الله معيدة")).toBe("عم");
    expect(getInitials("Youssef")).toBe("Y");
    expect(getInitials("فاطمة")).toBe("ف");
    expect(getInitials(null, "salim@example.com")).toBe("S");
    expect(getInitials("", "")).toBe("I");
  });

  test("2. next.config.ts includes googleusercontent.com in images.remotePatterns", async () => {
    const remotePatterns = nextConfig.images?.remotePatterns || [];
    const hasLh3 = remotePatterns.some(
      (p: any) => p.hostname === "lh3.googleusercontent.com"
    );
    const hasWildcardGoogle = remotePatterns.some(
      (p: any) => p.hostname === "*.googleusercontent.com"
    );

    expect(hasLh3).toBe(true);
    expect(hasWildcardGoogle).toBe(true);
  });

  test("3. Navbar renders UserAvatar with letter fallback and initials for authenticated user", async ({
    page,
  }) => {
    // Log in
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testEmail);
    await page.fill('[data-testid="login-password-input"]', testPassword);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL(/\/(account|events|$)/);

    // Verify navbar user menu has user avatar
    const userMenuBtn = page.locator('[data-testid="navbar-user-menu-btn"]');
    await expect(userMenuBtn).toBeVisible({ timeout: 10000 });

    const avatar = userMenuBtn.locator('[data-testid="user-avatar"]');
    await expect(avatar).toBeVisible();

    // Verify letter fallback has AM
    const fallback = avatar.locator('[data-testid="letter-avatar-fallback"]');
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveText("AM");
  });

  test("4. Account page and booking snapshot card render UserAvatar seamlessly", async ({
    page,
  }) => {
    // Visit /account
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testEmail);
    await page.fill('[data-testid="login-password-input"]', testPassword);
    await page.click('[data-testid="login-submit-btn"]');
    await page.waitForURL(/\/(account|events|$)/);

    await page.goto("/account");
    const accountAvatar = page.locator('[data-testid="account-profile-section"] [data-testid="user-avatar"]');
    await expect(accountAvatar).toBeVisible();
    const accountFallback = accountAvatar.locator('[data-testid="letter-avatar-fallback"]');
    await expect(accountFallback).toHaveText("AM");

    // Visit /book
    await page.goto("/book");
    const snapshotCard = page.locator('[data-testid="account-snapshot-card"]');
    await expect(snapshotCard).toBeVisible();
    const snapshotAvatar = snapshotCard.locator('[data-testid="user-avatar"]');
    await expect(snapshotAvatar).toBeVisible();
    const snapshotFallback = snapshotAvatar.locator('[data-testid="letter-avatar-fallback"]');
    await expect(snapshotFallback).toHaveText("AM");
  });
});
