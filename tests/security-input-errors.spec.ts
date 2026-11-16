import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";
import { safeActionError } from "../src/lib/safe-error";
import { isSafePublicImageUrl } from "../src/lib/upload-security";

assertDevBranchDatabase("Security input validation, anti-enumeration, and safe-error checks");

test.describe("IHY-SEC-013: input bounds, contact rate limit, anti-enumeration, safe errors", () => {
  test("safeActionError redacts internal errors and keeps auth errors", () => {
    const unauthErr = new Error("Internal detail");
    unauthErr.name = "UnauthorizedError";
    const forbErr = new Error("Internal detail");
    forbErr.name = "ForbiddenError";
    expect(safeActionError(unauthErr, "Fallback")).toBe("Unauthorized");
    expect(safeActionError(forbErr, "Fallback")).toBe("Forbidden");
    expect(
      safeActionError(new Error("Prisma select * from User failed: secret"), "Generic failure"),
    ).toBe("Generic failure");
  });

  test("isSafePublicImageUrl blocks javascript: and protocol-relative URLs", () => {
    expect(isSafePublicImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePublicImageUrl("//evil.example/img.png")).toBe(false);
    expect(isSafePublicImageUrl("/images/event.jpg")).toBe(true);
    expect(isSafePublicImageUrl("https://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toBe(
      true,
    );
  });

  test("verify-email resend gives identical neutral response for missing vs verified emails", async ({
    page,
  }) => {
    const verifiedUser = await createSyntheticUser("Verified Resend User");
    try {
      await page.clock.install();
      await page.goto("/verify-email?email=nonexistent-sec@example.test", { waitUntil: "load" });
      await expect(page.locator('[data-testid="verify-resend"]')).toBeVisible();
      for (let i = 0; i < 62; i += 1) {
        await page.clock.runFor(1000);
      }
      await expect(page.locator('[data-testid="verify-resend"]')).toBeEnabled();
      await page.locator('[data-testid="verify-resend"]').click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 10_000 });
      const missingToast = (await page.locator("[data-sonner-toast]").first().innerText()).trim();

      await page.goto(`/verify-email?email=${encodeURIComponent(verifiedUser.email)}`, {
        waitUntil: "load",
      });
      await expect(page.locator('[data-testid="verify-resend"]')).toBeVisible();
      for (let i = 0; i < 62; i += 1) {
        await page.clock.runFor(1000);
      }
      await expect(page.locator('[data-testid="verify-resend"]')).toBeEnabled();
      await page.locator('[data-testid="verify-resend"]').click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 10_000 });
      const verifiedToast = (await page.locator("[data-sonner-toast]").first().innerText()).trim();

      expect(missingToast).toBe(verifiedToast);
    } finally {
      await removeSyntheticUser(verifiedUser.id);
    }
  });

  test("contact form rejects oversized message and never stores it in DB", async ({ page }) => {
    const testEmail = `contact-sec-${Date.now()}@example.test`;
    try {
      await page.goto("/#contact", { waitUntil: "load" });
      await page.locator("#contact #name").fill("Security Check");
      await page.locator("#contact #email").fill(testEmail);
      await page.locator("#contact #message").fill("x".repeat(2005));
      await page.locator('#contact button[type="submit"]').click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 10_000 });

      const stored = await prisma.contactMessage.count({ where: { email: testEmail } });
      expect(stored).toBe(0);
    } finally {
      await prisma.contactMessage.deleteMany({ where: { email: testEmail } });
    }
  });
});
