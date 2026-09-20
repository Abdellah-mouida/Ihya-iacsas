import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

const OTP_SECRET = process.env.OTP_SECRET || "ihyaa-secure-production-salt-2026";

function computeHash(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
    .digest("hex");
}

test.describe("Booking Flow Overhaul, MailerSend & Secure OTP", () => {
  const testEmail = "playwright.test@gmail.com";

  test.beforeEach(async () => {
    // Clean up test bookings, OTPs and rate limits
    await prisma.booking.deleteMany({
      where: { email: { in: [testEmail, "unapproved@bad-domain.xyz"] } },
    });
    await prisma.otpVerification.deleteMany({
      where: { email: { in: [testEmail, "unapproved@bad-domain.xyz"] } },
    });
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          in: [
            `otp_gen_cooldown:${testEmail}`,
            `otp_gen_window:${testEmail}`,
            `otp_ver_rate:${testEmail}`,
          ],
        },
      },
    });
  });

  test("1. Reject email domain outside allow-list with inline error message", async ({
    page,
  }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Test Attendee");
    await page.fill("#b-email", "unapproved@bad-domain.xyz");

    // Select Moroccan city via Combobox
    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-rabat"]');

    await page.fill("#b-age", "25");

    await page.click('button[type="submit"]');

    const emailError = page.getByTestId("email-error");
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText(/Gmail|Yahoo|Outlook/i);

    // Verify still on step 1 (details)
    await expect(page.locator("#b-otp")).not.toBeVisible();
  });

  test("2. City Combobox searchable filtering and selection", async ({
    page,
  }) => {
    await page.goto("/events/majlis-ihyaa/book");

    const trigger = page.locator('[data-testid="city-combobox-trigger"]');
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Verify dropdown is open
    const dropdown = page.locator('[data-testid="city-dropdown"]');
    await expect(dropdown).toBeVisible();

    // Filter by typing in search box
    const searchInput = page.locator('[data-testid="city-search-input"]');
    await searchInput.fill("طنجة");

    // Click filtered option
    const option = page.locator('[data-testid="city-option-tangier"]');
    await expect(option).toBeVisible();
    await option.click();

    // Dropdown closes and trigger shows selected city
    await expect(dropdown).not.toBeVisible();
    await expect(trigger).toContainText("طنجة");
  });

  test("3. Wrong OTP attempt displays remaining attempts error", async ({
    page,
  }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Test Attendee");
    await page.fill("#b-email", testEmail);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-tetouan"]');

    await page.fill("#b-age", "23");
    await page.fill(
      "#b-motive",
      "Interest in personal development and spiritual growth",
    );

    await page.click('button[type="submit"]');

    // Wait for step 2 segmented OTP input
    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 10000 });

    // Enter wrong 6-digit OTP into boxes
    for (let i = 0; i < 6; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, "0");
    }

    await page.click('button[type="submit"]');

    const otpError = page.getByTestId("otp-error");
    await expect(otpError).toBeVisible();
    await expect(otpError).toContainText(/غير صحيح|invalid/i);
  });

  test("4. Expired OTP attempt displays expiry error message", async ({
    page,
  }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Expired Tester");
    await page.fill("#b-email", testEmail);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-casablanca"]');

    await page.fill("#b-age", "28");

    await page.click('button[type="submit"]');

    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 10000 });

    // Manually set expiresAt in DB to past date to simulate expiration
    await prisma.otpVerification.updateMany({
      where: { email: testEmail, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) }, // 1 min ago
    });

    for (let i = 0; i < 6; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, "1");
    }

    await page.click('button[type="submit"]');

    const otpError = page.getByTestId("otp-error");
    await expect(otpError).toBeVisible();
    await expect(otpError).toContainText(/صلاحيت|انتهت|expired/i);
  });

  test("5. 30-Second Resend Countdown display", async ({ page }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Resend Tester");
    await page.fill("#b-email", testEmail);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-fes"]');

    await page.fill("#b-age", "22");

    await page.click('button[type="submit"]');

    const countdown = page.getByTestId("resend-timer-countdown");
    await expect(countdown).toBeVisible({ timeout: 10000 });
    await expect(countdown).toContainText(/ثانية|s/i);
  });

  test("6. Full successful booking run: OTP verification, confirmation, redirect, and event page booked state", async ({
    page,
  }) => {
    await page.goto("/events/majlis-ihyaa/book");

    // Check logo circular crop
    const logo = page.locator('header a[aria-label="Ihyaa"] img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveClass(/rounded-full/);

    // Step 1: Fill details with Moroccan city
    await page.fill("#b-name", "زكرياء المنصوري");
    await page.fill("#b-email", testEmail);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-tangier"]');

    await page.fill("#b-age", "24");
    await page.fill("#b-motive", "المشاركة في أنشطة جمعية إحياء الهادفة");

    await page.click('button[type="submit"]');

    // Wait for step 2
    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 10000 });

    // Retrieve active OTP record and set known OTP hash for deterministic testing
    const activeOtp = await prisma.otpVerification.findFirst({
      where: { email: testEmail, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(activeOtp).toBeTruthy();

    const testOtp = "987654";
    const testHash = computeHash(testOtp, testEmail);

    await prisma.otpVerification.update({
      where: { id: activeOtp!.id },
      data: {
        otpHash: testHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Enter correct OTP across segmented boxes
    for (let i = 0; i < testOtp.length; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, testOtp[i]);
    }

    // Since onComplete auto-submits on the 6th digit, wait for step 3 confirmation directly
    const bookingRef = page.getByTestId("booking-ref-display");
    await expect(bookingRef).toBeVisible({ timeout: 10000 });
    await expect(bookingRef).toContainText(/IHY-/);

    // Verify redirect notice is visible with countdown
    const redirectNotice = page.getByTestId("redirect-notice");
    await expect(redirectNotice).toBeVisible();

    // Wait for automatic redirect to /events (within 6 seconds)
    await page.waitForURL("**/events", { timeout: 8000 });

    // On event page, verify "You're booked — your booking was successful" state replaces normal CTA
    const bookedBadge = page.getByTestId("booked-state-badge");
    await expect(bookedBadge).toBeVisible();
    await expect(bookedBadge).toContainText(/أنت مسجل|You're booked/i);
  });

  test("7. Light mode & Dark mode verification", async ({ page }) => {
    // Light mode test
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/events/majlis-ihyaa/book");
    await expect(page.locator("body")).toBeVisible();

    // Dark mode test
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/events/majlis-ihyaa/book");
    await expect(page.locator("body")).toBeVisible();
  });
});
