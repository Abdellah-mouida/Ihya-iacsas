import { Page, expect } from "@playwright/test";
import { prisma } from "../../src/lib/prisma";
import bcrypt from "bcryptjs";

export const TEST_ADMIN = {
  email: "admin.suite.test@ihyaa.test",
  password: "AdminPassword123!",
  fullName: "مسؤول النظام التجريبي",
  role: "ADMIN" as const,
};

export const TEST_MODERATOR = {
  email: "moderator.suite.test@ihyaa.test",
  password: "ModPassword123!",
  fullName: "مشرف الفعاليات التجريبي",
  role: "MODERATOR" as const,
};

export const TEST_REGULAR_USER = {
  email: "user.suite.test@ihyaa.test",
  password: "UserPassword123!",
  fullName: "مستخدم عادي تجريبي",
  role: "USER" as const,
};

export async function ensureTestUser(user: {
  email: string;
  password: string;
  fullName: string;
  role: "USER" | "MODERATOR" | "ADMIN";
}) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  return await prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.fullName,
      passwordHash,
      role: user.role,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
    },
    create: {
      email: user.email,
      name: user.fullName,
      passwordHash,
      role: user.role,
      emailVerified: new Date(),
      onboardingCompletedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "2026-10-11",
      sessionVersion: 1,
    },
  });
}

export async function loginAs(
  page: Page,
  user: { email: string; password: string; role?: string },
  targetUrl = "/admin"
) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(targetUrl)}`);
  await page.fill('[data-testid="login-email-input"]', user.email);
  await page.fill('[data-testid="login-password-input"]', user.password);
  await page.click('[data-testid="login-submit-btn"]');
  await page.waitForURL(
    (url) =>
      url.pathname.includes(targetUrl) ||
      url.pathname.includes("/403") ||
      url.pathname.includes("/account"),
    { timeout: 30000 }
  );
}

export async function loginAdmin(page: Page) {
  await ensureTestUser(TEST_ADMIN);
  await loginAs(page, TEST_ADMIN, "/admin");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30000 });
  await expect(page.locator("aside")).toBeVisible({ timeout: 30000 });
}
