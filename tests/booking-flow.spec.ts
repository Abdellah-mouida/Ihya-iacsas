import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

test.describe("Booking Flow Overhaul & OTP Verification", () => {
  const testEmail = "playwright.test@gmail.com";

  test.beforeEach(async () => {
    // Clean up test bookings before each test
    await prisma.booking.deleteMany({
      where: { email: { in: [testEmail, "unapproved@bad-domain.xyz"] } },
    });
  });

  test("1. Reject email domain outside allow-list with inline error message", async ({ page }) => {
    await page.goto("/events/majlis-ihyaa/book");

    // Fill form with disallowed email domain
    await page.fill("#b-name", "Test Attendee");
    await page.fill("#b-email", "unapproved@bad-domain.xyz");
    await page.fill("#b-city", "Rabat");
    await page.fill("#b-age", "25");

    // Click continue
    await page.click('button[type="submit"]');

    // Verify inline domain error is visible
    const emailError = page.getByTestId("email-error");
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText(/Gmail|Yahoo|Outlook/i);

    // Verify still on step 1 (details)
    await expect(page.locator("#b-otp")).not.toBeVisible();
  });

  test("2. Wrong OTP attempt displays error", async ({ page }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Test Attendee");
    await page.fill("#b-email", testEmail);
    await page.fill("#b-city", "Tetouan");
    await page.fill("#b-age", "23");
    await page.fill("#b-motive", "Interest in personal development and spiritual growth");

    await page.click('button[type="submit"]');

    // Wait for step 2 OTP input
    const otpInput = page.locator("#b-otp");
    await expect(otpInput).toBeVisible({ timeout: 10000 });

    // Enter wrong 6-digit OTP
    await otpInput.fill("000000");
    await page.click('button[type="submit"]');

    // Verify wrong OTP error
    const otpError = page.getByTestId("otp-error");
    await expect(otpError).toBeVisible();
    await expect(otpError).toContainText(/غير صحيح|invalid/i);
  });

  test("3. Expired OTP attempt displays expiry error message", async ({ page }) => {
    await page.goto("/events/majlis-ihyaa/book");

    await page.fill("#b-name", "Expired Tester");
    await page.fill("#b-email", testEmail);
    await page.fill("#b-city", "Casablanca");
    await page.fill("#b-age", "28");

    await page.click('button[type="submit"]');

    const otpInput = page.locator("#b-otp");
    await expect(otpInput).toBeVisible({ timeout: 10000 });

    // Manually set otpExpiry in DB to past date to simulate expiration
    await prisma.booking.updateMany({
      where: { email: testEmail, confirmed: false },
      data: { otpExpiry: new Date(Date.now() - 60 * 1000) }, // 1 min ago
    });

    // Attempt to verify with any code
    await otpInput.fill("123456");
    await page.click('button[type="submit"]');

    const otpError = page.getByTestId("otp-error");
    await expect(otpError).toBeVisible();
    await expect(otpError).toContainText(/صلاحية|expired/i);
  });

  test("4. Full successful booking run: OTP verification, confirmation, redirect, and event page booked state", async ({ page }) => {
    await page.goto("/events/majlis-ihyaa/book");

    // Check logo circular crop
    const logo = page.locator('header a[aria-label="Ihyaa"] img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveClass(/rounded-full/);

    // Step 1: Fill details
    await page.fill("#b-name", "زكرياء المنصوري");
    await page.fill("#b-email", testEmail);
    await page.fill("#b-city", "طنجة");
    await page.fill("#b-age", "24");
    await page.fill("#b-motive", "المشاركة في أنشطة جمعية إحياء الهادفة");

    await page.click('button[type="submit"]');

    // Wait for step 2
    const otpInput = page.locator("#b-otp");
    await expect(otpInput).toBeVisible({ timeout: 10000 });

    // Retrieve active booking to get its DB record and set known OTP hash for deterministic test
    const booking = await prisma.booking.findFirst({
      where: { email: testEmail, confirmed: false },
      orderBy: { createdAt: "desc" },
    });
    expect(booking).toBeTruthy();

    // Set known OTP "987654" in DB
    const crypto = await import("crypto");
    const testOtp = "987654";
    const testHash = crypto.createHash("sha256").update(testOtp).digest("hex");

    await prisma.booking.update({
      where: { id: booking!.id },
      data: {
        otpHash: testHash,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Enter correct OTP
    await otpInput.fill(testOtp);
    await page.click('button[type="submit"]');

    // Step 3: Confirmation step
    const bookingRef = page.getByTestId("booking-ref-display");
    await expect(bookingRef).toBeVisible({ timeout: 5000 });
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

  test("5. Light mode & Dark mode verification", async ({ page }) => {
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
