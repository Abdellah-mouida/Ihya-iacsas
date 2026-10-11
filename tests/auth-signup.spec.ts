import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashOtp } from "../src/lib/otp";

const prisma = new PrismaClient();

test.describe("Task 3: Sign Up and Email Verification", () => {
  const testEmail = `test.user.${Date.now()}@example.com`;
  const testPassword = "Password123!";
  const testName = "عبد الله المرابط";

  test.afterAll(async () => {
    // Cleanup test records
    await prisma.otpVerification.deleteMany({ where: { email: { contains: "test.user." } } });
    await prisma.booking.deleteMany({ where: { email: { contains: "test.user." } } });
    await prisma.user.deleteMany({ where: { email: { contains: "test.user." } } });
    await prisma.$disconnect();
  });

  test("1. Signup page renders with all fields, password rules, and terms links", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-confirm-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-terms"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-submit"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-google"]')).toBeVisible();

    // Verify terms and privacy links in signup form
    const termsLink = page.locator('[data-testid="signup-form"] a[href="/terms"]');
    const privacyLink = page.locator('[data-testid="signup-form"] a[href="/privacy"]');
    await expect(termsLink).toBeVisible();
    await expect(privacyLink).toBeVisible();
  });

  test("2. Real-time password validation responds to typing and checks matching", async ({ page }) => {
    await page.goto("/signup");

    const passwordInput = page.locator('[data-testid="signup-password"]');
    const confirmInput = page.locator('[data-testid="signup-confirm-password"]');

    // Type weak password
    await passwordInput.fill("abc");
    // Checklist should appear
    await expect(page.getByText("قوة كلمة المرور:")).toBeVisible();

    // Type valid password
    await passwordInput.fill(testPassword);

    // Mismatched confirm password
    await confirmInput.fill("Different123!");
    await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();

    // Matching confirm password
    await confirmInput.fill(testPassword);
    await expect(page.getByText("كلمتا المرور متطابقتان")).toBeVisible();
  });

  test("3. Form requires Terms acceptance before submission", async ({ page }) => {
    await page.goto("/signup");

    await page.locator('[data-testid="signup-name"]').fill(testName);
    await page.locator('[data-testid="signup-email"]').fill(testEmail);
    await page.locator('[data-testid="signup-password"]').fill(testPassword);
    await page.locator('[data-testid="signup-confirm-password"]').fill(testPassword);

    // Leave terms unchecked and click submit
    await page.locator('[data-testid="signup-submit"]').click();

    // Should display toast error
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: "يجب الموافقة على شروط الاستخدام" }),
    ).toBeVisible();
  });

  test("4. Legacy booking exists before signup -> signup creates unverified user and OTP", async ({ page }) => {
    // 1. Create a legacy unlinked booking for this test email
    const event = await prisma.event.findFirst({ where: { bookingOpen: true } });
    if (event) {
      await prisma.booking.create({
        data: {
          eventId: event.id,
          fullName: testName,
          email: testEmail,
          city: "الرباط",
          age: 24,
          confirmed: true,
          status: "CONFIRMED",
          userId: null,
        },
      });
    }

    // 2. Perform signup
    await page.goto("/signup");
    await page.locator('[data-testid="signup-name"]').fill(testName);
    await page.locator('[data-testid="signup-email"]').fill(testEmail);
    await page.locator('[data-testid="signup-password"]').fill(testPassword);
    await page.locator('[data-testid="signup-confirm-password"]').fill(testPassword);
    await page.locator('[data-testid="signup-terms"]').check();

    await page.locator('[data-testid="signup-submit"]').click();

    // Should navigate to /verify-email?email=...
    await page.waitForURL(/\/verify-email\?email=/, { timeout: 30000 });
    await expect(page.locator('[data-testid="verify-email-display"]')).toContainText(testEmail);

    // Verify user exists in DB with unverified email
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.emailVerified).toBeNull();

    // Verify OTP record created in DB
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: testEmail, purpose: "ACCOUNT_VERIFY", usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(otpRecord).not.toBeNull();
  });

  test("5. Entering invalid OTP shows error; entering valid OTP verifies user and links legacy booking", async ({ page }) => {
    await page.goto(`/verify-email?email=${encodeURIComponent(testEmail)}`);
    await expect(page.locator('[data-testid="verify-otp-container"]')).toBeVisible();

    // 1. Try invalid OTP
    const digitInputs = page.locator('[data-testid="segmented-otp-input"] input');
    await digitInputs.first().focus();
    await page.keyboard.type("000000");

    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: "رمز التحقق غير صحيح" }),
    ).toBeVisible({ timeout: 15000 });

    // 2. Set known OTP in DB
    const knownOtp = "789123";
    const knownHash = hashOtp(knownOtp, testEmail);
    await prisma.otpVerification.updateMany({
      where: { email: testEmail, purpose: "ACCOUNT_VERIFY", usedAt: null },
      data: { otpHash: knownHash, attempts: 0 },
    });

    // 3. Reload page to reset OTP input state cleanly
    await page.reload();
    await expect(page.locator('[data-testid="verify-otp-container"]')).toBeVisible();

    // Type valid OTP into clean boxes
    for (let i = 0; i < 6; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, knownOtp[i]);
    }

    // Should redirect to /login with verified=true
    await page.waitForURL(/\/login\?verified=true/, { timeout: 30000 });

    // Verify user in DB is now verified
    const updatedUser = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(updatedUser?.emailVerified).not.toBeNull();

    // Verify legacy booking was linked to this new user!
    const linkedBooking = await prisma.booking.findFirst({
      where: { email: testEmail },
    });
    expect(linkedBooking?.userId).toBe(updatedUser?.id);
  });

  test("6. Signup with already verified email rejects duplicate with friendly error", async ({ page }) => {
    await page.goto("/signup");

    await page.locator('[data-testid="signup-name"]').fill(testName);
    await page.locator('[data-testid="signup-email"]').fill(testEmail);
    await page.locator('[data-testid="signup-password"]').fill(testPassword);
    await page.locator('[data-testid="signup-confirm-password"]').fill(testPassword);
    await page.locator('[data-testid="signup-terms"]').check();

    await page.locator('[data-testid="signup-submit"]').click();

    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: "هذا البريد الإلكتروني مسجل بالفعل" }),
    ).toBeVisible({ timeout: 15000 });
  });
});
