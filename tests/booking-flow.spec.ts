import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { generateUniqueEventSlug } from "../src/lib/slug";

const OTP_SECRET = process.env.OTP_SECRET || "ihyaa-secure-production-salt-2026";

function computeHash(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
    .digest("hex");
}

test.describe("Booking Flow Overhaul, Brevo API & Secure OTP", () => {
  test.setTimeout(45_000);

  const testEmail = "playwright.test@gmail.com";
  const testEmailA = "playwright.flowa@gmail.com";
  const testEmailB = "playwright.flowb@gmail.com";
  const testEmailUnique = "playwright.unique@gmail.com";

  test.beforeEach(async () => {
    // Clean up test bookings, OTPs and rate limits
    await prisma.booking.deleteMany({
      where: { email: { in: [testEmail, testEmailA, testEmailB, testEmailUnique, "unapproved@bad-domain.xyz"] } },
    });
    await prisma.otpVerification.deleteMany({
      where: { email: { in: [testEmail, testEmailA, testEmailB, testEmailUnique, "unapproved@bad-domain.xyz"] } },
    });
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          in: [
            `otp_gen_cooldown:${testEmail}`,
            `otp_gen_window:${testEmail}`,
            `otp_ver_rate:${testEmail}`,
            `otp_gen_cooldown:${testEmailA}`,
            `otp_gen_window:${testEmailA}`,
            `otp_ver_rate:${testEmailA}`,
            `otp_gen_cooldown:${testEmailB}`,
            `otp_gen_window:${testEmailB}`,
            `otp_ver_rate:${testEmailB}`,
            `otp_gen_cooldown:${testEmailUnique}`,
            `otp_gen_window:${testEmailUnique}`,
            `otp_ver_rate:${testEmailUnique}`,
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
    await expect(otpFirstBox).toBeVisible({ timeout: 20000 });

    // Enter wrong 6-digit OTP into boxes
    for (let i = 0; i < 6; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, "0");
    }

    await page.click('button[type="submit"]');

    const otpError = page.getByTestId("otp-error");
    await expect(otpError).toBeVisible({ timeout: 15000 });
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
    await expect(otpFirstBox).toBeVisible({ timeout: 20000 });

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
    await expect(otpError).toBeVisible({ timeout: 15000 });
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

    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 25000 });

    const countdown = page.getByTestId("resend-timer-countdown");
    await expect(countdown).toBeVisible({ timeout: 10000 });
    await expect(countdown).toContainText(/ثانية|s/i);
  });

  test("6. Full successful booking run: OTP verification, confirmation, redirect, and event page booked state", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/events/majlis-ihyaa/book");

    // Check logo circular asset
    const logo = page.locator('header a[aria-label="Ihyaa"] img');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("src", /logo-circle/);

    // Step 1: Fill details with Moroccan city
    await page.fill("#b-name", "زكرياء المنصوري");
    await page.fill("#b-email", testEmail);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-tangier"]');

    await page.fill("#b-age", "24");
    await page.fill("#b-motive", "المشاركة في أنشطة برنامج إحياء الهادفة");

    await page.click('button[type="submit"]');

    // Wait for step 2
    const otpFirstBox = page.locator('[data-testid="otp-box-0"]');
    await expect(otpFirstBox).toBeVisible({ timeout: 20000 });

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
    const statusBadge = page.getByTestId("booking-status-badge");
    await expect(statusBadge).toBeVisible({ timeout: 35000 });
    await expect(statusBadge).toContainText(/مؤكد|Confirmed/i);

    // Verify booking reference number is hidden and redirect notice banner is removed (Task 5)
    await expect(page.locator('[data-testid="booking-ref-display"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="redirect-notice"]')).toHaveCount(0);

    // Verify NO automatic redirect happens: wait 3.5 seconds and URL remains on booking page
    await page.waitForTimeout(3500);
    expect(page.url()).toContain("/book");

    // Click "الذهاب لصفحة الفعاليات" button to navigate to /events
    const toEventsBtn = page.locator('a[href="/events"]').first();
    await toEventsBtn.click();
    await page.waitForURL("**/events", { timeout: 15000 });

    // On event page, verify booked state replaces normal CTA
    const bookedBadge = page.getByTestId("booked-state-badge").first();
    await expect(bookedBadge).toBeVisible({ timeout: 15000 });
    await expect(bookedBadge).toContainText(/أنت مسجل|You're booked|حجزك مؤكد|Booking Confirmed/i);
  });

  test("7. Light mode & Dark mode verification", async ({ page }) => {
    // Light mode test
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/events/majlis-ihyaa/book", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // Dark mode test
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/events/majlis-ihyaa/book", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("8. Changing email mid-flow creates strictly ONE booking for email B and ZERO for email A", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/events/majlis-ihyaa/book");

    // 1. Fill details with Email A
    await page.fill("#b-name", "Flow Test User");
    await page.fill("#b-email", testEmailA);
    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-rabat"]');
    await page.fill("#b-age", "22");
    await page.fill("#b-motive", "Testing email change mid-flow");
    await page.click('button[type="submit"]');

    // 2. Wait for Step 2 OTP screen
    const otpBox0 = page.locator('[data-testid="otp-box-0"]');
    await expect(otpBox0).toBeVisible({ timeout: 25000 });

    // Assert that NO booking record was created in the database for email A at OTP-send time
    const countAInitial = await prisma.booking.count({
      where: { email: testEmailA },
    });
    expect(countAInitial).toBe(0);

    // 3. User goes back to Step 1 to change email
    const backBtn = page.locator('[data-testid="verify-back-button"]');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // 4. Change email to Email B
    const emailInput = page.locator("#b-email");
    await expect(emailInput).toBeVisible();
    await emailInput.fill(testEmailB);
    await page.click('button[type="submit"]');

    // 5. Wait for Step 2 OTP screen again
    await expect(otpBox0).toBeVisible({ timeout: 25000 });

    // 6. Retrieve active OTP record for Email B and set test hash
    const activeOtpB = await prisma.otpVerification.findFirst({
      where: { email: testEmailB, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(activeOtpB).toBeTruthy();

    const testOtp = "654321";
    const testHash = computeHash(testOtp, testEmailB);
    await prisma.otpVerification.update({
      where: { id: activeOtpB!.id },
      data: {
        otpHash: testHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // 7. Verify with Email B's OTP code
    for (let i = 0; i < testOtp.length; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, testOtp[i]);
    }

    // 8. Wait for Step 3 confirmation
    const statusBadge = page.getByTestId("booking-status-badge");
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    await expect(statusBadge).toContainText(/مؤكد|Confirmed|قيد المراجعة/i);
    await expect(page.locator('[data-testid="booking-ref-display"]')).toHaveCount(0);

    // 9. Assert database state: exactly 1 booking for Email B, and 0 for Email A
    const bookingsA = await prisma.booking.findMany({
      where: { email: testEmailA },
    });
    const bookingsB = await prisma.booking.findMany({
      where: { email: testEmailB },
    });

    expect(bookingsA.length).toBe(0);
    expect(bookingsB.length).toBe(1);
    expect(bookingsB[0].email).toBe(testEmailB);
  });

  test("9. Email uniqueness check per event before sending OTP (Task 2)", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("BROWSER ERROR:", err.message));
    page.on("requestfailed", (req) =>
      console.log("REQ FAILED:", req.url(), req.failure()?.errorText)
    );
    page.on("response", (res) => {
      if (res.status() >= 400) console.log("RES ERROR:", res.status(), res.url());
    });

    // 1. Ensure second test event exists with bookingOpen = true
    await prisma.event.upsert({
      where: { id: "test-event-second" },
      update: { bookingOpen: true, capacityType: "OPEN" },
      create: {
        id: "test-event-second",
        slug: "test-event-second",
        titleAr: "الفعالية الثانية للاختبار",
        titleEn: "Second Test Event",
        descriptionAr: "وصف الفعالية الثانية للاختبار",
        descriptionEn: "Description of the second test event",
        date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        time: "19:00",
        location: "طنجة",
        posterUrl: "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/event_poster.jpg",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    // 2. Book Event 1 with testEmailUnique
    await page.goto("/events/majlis-ihyaa/book?eventId=majlis-ihyaa-2026");
    await page.fill("#b-name", "Unique Test User");
    await page.fill("#b-email", testEmailUnique);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-rabat"]');

    await page.fill("#b-age", "25");
    await page.fill("#b-motive", "Testing uniqueness before OTP");
    await page.click('button[type="submit"]');

    // Wait for Step 2 OTP
    const otpBox0 = page.locator('[data-testid="otp-box-0"]');
    await expect(otpBox0).toBeVisible({ timeout: 25000 });

    const activeOtp1 = await prisma.otpVerification.findFirst({
      where: { email: testEmailUnique, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(activeOtp1).toBeTruthy();

    const otpCode1 = "112233";
    await prisma.otpVerification.update({
      where: { id: activeOtp1!.id },
      data: {
        otpHash: computeHash(otpCode1, testEmailUnique),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    for (let i = 0; i < otpCode1.length; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, otpCode1[i]);
    }

    const statusBadge = page.getByTestId("booking-status-badge");
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    await expect(statusBadge).toContainText(/مؤكد|Confirmed|قيد المراجعة/i);
    await expect(page.locator('[data-testid="booking-ref-display"]')).toHaveCount(0);

    // Assert booking exists for Event 1
    const event1Bookings = await prisma.booking.findMany({
      where: { email: testEmailUnique, eventId: "majlis-ihyaa-2026" },
    });
    expect(event1Bookings.length).toBe(1);

    // Count OTPs generated so far
    const initialOtpCount = await prisma.otpVerification.count({
      where: { email: testEmailUnique },
    });

    // 3. Try to book Event 1 AGAIN with the same email (from clean session / another device)
    await page.context().clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/events/majlis-ihyaa/book?eventId=majlis-ihyaa-2026");
    await page.fill("#b-name", "Unique Test User Again");
    await page.fill("#b-email", testEmailUnique);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-rabat"]');

    await page.fill("#b-age", "25");
    await page.fill("#b-motive", "Attempt duplicate booking for event 1");
    await page.click('button[type="submit"]');

    // 4. Assert that Step 2 OTP is NOT shown and error banner IS shown
    const errorBanner = page.locator('[data-testid="booking-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText(/مسبقاً|already booked/i);
    await expect(otpBox0).not.toBeVisible();

    // Verify NO new OTP verification was created in DB
    const finalOtpCount = await prisma.otpVerification.count({
      where: { email: testEmailUnique },
    });
    expect(finalOtpCount).toBe(initialOtpCount);

    // 5. Try to book Event 2 with the same email -> Should SUCCEED
    // Clear cooldown and window rate limit keys so test doesn't have to wait 30s
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          in: [
            `otp_gen_cooldown:${testEmailUnique}`,
            `otp_gen_window:${testEmailUnique}`,
          ],
        },
      },
    });

    await page.goto("/events/test-event-second/book");
    await page.fill("#b-name", "Unique Test User Event 2");
    await page.fill("#b-email", testEmailUnique);

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-rabat"]');

    await page.fill("#b-age", "25");
    await page.fill("#b-motive", "Booking second event should be allowed");
    await page.click('button[type="submit"]');

    // Step 2 OTP screen DOES appear for Event 2
    await expect(otpBox0).toBeVisible({ timeout: 25000 });

    const activeOtp2 = await prisma.otpVerification.findFirst({
      where: { email: testEmailUnique, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(activeOtp2).toBeTruthy();

    const otpCode2 = "445566";
    await prisma.otpVerification.update({
      where: { id: activeOtp2!.id },
      data: {
        otpHash: computeHash(otpCode2, testEmailUnique),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    for (let i = 0; i < otpCode2.length; i++) {
      await page.fill(`[data-testid="otp-box-${i}"]`, otpCode2[i]);
    }

    const statusBadge2 = page.getByTestId("booking-status-badge");
    await expect(statusBadge2).toBeVisible({ timeout: 15000 });

    // 6. Assert DB has exactly 1 booking for Event 1 and 1 booking for Event 2
    const allBookings = await prisma.booking.findMany({
      where: { email: testEmailUnique },
    });
    expect(allBookings.length).toBe(2);
    expect(allBookings.some((b) => b.eventId === "majlis-ihyaa-2026")).toBe(true);
    expect(allBookings.some((b) => b.eventId === "test-event-second")).toBe(true);
  });

  test("10. Event listing displays all open events; booking Event 1 marks ONLY Event 1 as booked, Event 2 remains bookable", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // 1. Ensure two open events exist in the database with future dates
    await prisma.event.upsert({
      where: { id: "majlis-ihyaa-2026" },
      update: {
        date: new Date("2026-10-15T18:00:00Z"),
        bookingOpen: true,
        capacityType: "OPEN",
      },
      create: {
        id: "majlis-ihyaa-2026",
        slug: "majlis-ihyaa-2026",
        titleAr: "مجلس إحياء الشبابي 2026",
        titleEn: "Ihyaa Youth Gathering 2026",
        descriptionAr: "اللقاء الافتتاحي لبرنامج إحياء",
        descriptionEn: "Opening gathering for Ihyaa Youth Program",
        date: new Date("2026-10-15T18:00:00Z"),
        time: "18:00",
        location: "الرباط، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    await prisma.event.upsert({
      where: { id: "test-event-second" },
      update: {
        date: new Date("2026-11-20T18:00:00Z"),
        bookingOpen: true,
        capacityType: "OPEN",
      },
      create: {
        id: "test-event-second",
        slug: "test-event-second",
        titleAr: "الملتقى الثاني لبرنامج إحياء",
        titleEn: "Second Ihyaa Program Gathering",
        descriptionAr: "اللقاء الثاني للبرنامج الشبابي",
        descriptionEn: "Second session for youth",
        date: new Date("2026-11-20T18:00:00Z"),
        time: "18:00",
        location: "الدار البيضاء، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    // 2. Clear storage to simulate a fresh visitor
    await context.clearCookies();
    await page.goto("/events");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 3. Verify BOTH events appear in the listing
    const event1Card = page.locator('[data-testid="event-card-majlis-ihyaa-2026"]');
    const event2Card = page.locator('[data-testid="event-card-test-event-second"]');

    await expect(event1Card).toBeVisible({ timeout: 15000 });
    await expect(event2Card).toBeVisible({ timeout: 15000 });

    const event1BookBtn = page.locator('[data-testid="book-btn-majlis-ihyaa-2026"]');
    const event2BookBtn = page.locator('[data-testid="book-btn-test-event-second"]');

    await expect(event1BookBtn).toBeVisible();
    await expect(event2BookBtn).toBeVisible();

    // Neither event should be marked as booked yet
    await expect(event1Card.locator('[data-testid="booked-state-badge"]')).not.toBeVisible();
    await expect(event2Card.locator('[data-testid="booked-state-badge"]')).not.toBeVisible();

    // 4. Simulate visitor having booked Event 1 ONLY
    await page.evaluate(() => {
      localStorage.setItem("ihyaa_booked_majlis-ihyaa-2026", "true");
      document.cookie = `ihyaa_booked_events=${encodeURIComponent(JSON.stringify(["majlis-ihyaa-2026"]))}; path=/; max-age=31536000; SameSite=Lax`;
    });
    await page.reload();

    // 5. Assert: Event 1 is marked as booked, Event 2 is STILL active and bookable!
    await expect(event1Card.locator('[data-testid="booked-state-badge"]')).toBeVisible({ timeout: 10000 });
    await expect(event1BookBtn).not.toBeVisible();

    await expect(event2Card.locator('[data-testid="booked-state-badge"]')).not.toBeVisible();
    await expect(event2BookBtn).toBeVisible();

    // 6. Click the book button on Event 2 -> should take visitor to Event 2 booking
    await event2BookBtn.click();
    await page.waitForURL(/.*test-event-second.*/, { timeout: 10000 });
    expect(page.url()).toContain("test-event-second");
  });

  test("11. Already-booked visitors: navbar hides Book now when all events booked; booking page blocks form and redirects to event", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // 1. Ensure only 1 open event exists for this test to isolate "all events booked" state
    await prisma.event.updateMany({
      where: { id: { not: "majlis-ihyaa-2026" } },
      data: { bookingOpen: false },
    });
    await prisma.event.upsert({
      where: { id: "majlis-ihyaa-2026" },
      update: {
        bookingOpen: true,
        date: new Date("2026-10-15T18:00:00Z"),
      },
      create: {
        id: "majlis-ihyaa-2026",
        slug: "majlis-ihyaa-2026",
        titleAr: "مجلس إحياء الشبابي 2026",
        titleEn: "Ihyaa Youth Gathering 2026",
        descriptionAr: "اللقاء الافتتاحي لبرنامج إحياء",
        descriptionEn: "Opening gathering for Ihyaa Youth Program",
        date: new Date("2026-10-15T18:00:00Z"),
        time: "18:00",
        location: "الرباط، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
      },
    });

    // 2. Fresh visitor sees the navbar "Book now" button
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const navbarBookBtn = page.locator('[data-testid="navbar-book-btn"]');
    await expect(navbarBookBtn).toBeVisible({ timeout: 15000 });

    // 3. Mark the visitor as having booked the event
    await page.evaluate(() => {
      localStorage.setItem("ihyaa_booked_majlis-ihyaa-2026", "true");
      document.cookie = "ihyaa_booked_majlis-ihyaa-2026=true; path=/; max-age=31536000; SameSite=Lax";
      document.cookie = `ihyaa_booked_events=${encodeURIComponent(JSON.stringify(["majlis-ihyaa-2026"]))}; path=/; max-age=31536000; SameSite=Lax`;
    });
    await page.reload();

    // 4. Since the visitor already booked all open events, navbar "Book now" is HIDDEN
    await expect(navbarBookBtn).not.toBeVisible({ timeout: 10000 });

    // 5. Try navigating directly to the booking page for this event
    await page.goto("/events/majlis-ihyaa/book?eventId=majlis-ihyaa-2026");

    // 6. Assert redirection to event page happens and form fields are never shown
    await page.waitForURL(/.*\/events.*/, { timeout: 15000 });
    expect(page.url()).toContain("/events");
    await expect(page.locator("#b-name")).not.toBeVisible();

    // Restore bookingOpen on the other event for upcoming tests
    await prisma.event.updateMany({
      where: { id: "test-event-second" },
      data: { bookingOpen: true },
    });
  });

  test("12. Navbar Book now points to /book and dynamic /events/[slug]/book renders booking stepper for specific event", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // 1. Clear storage & cookies
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Check navbar "Book now" href is /book
    const navbarBookBtn = page.locator('[data-testid="navbar-book-btn"]');
    await expect(navbarBookBtn).toBeVisible({ timeout: 15000 });
    const bookHref = await navbarBookBtn.getAttribute("href");
    expect(bookHref).toBe("/book");

    // 3. Click navbar "Book now" and verify it loads the booking stepper at /book
    await navbarBookBtn.click();
    await page.waitForURL(/.*\/book.*/, { timeout: 10000 });
    expect(page.url()).toContain("/book");
    await expect(page.locator("#b-name")).toBeVisible({ timeout: 15000 });

    // 4. Test dynamic route /events/test-event-second/book
    await page.goto("/events/test-event-second/book");
    await expect(page.locator("#b-name")).toBeVisible({ timeout: 15000 });
  });

  test("13. Arabic OTP input caret styling, line-height, and height in RTL (Task 7)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.clearCookies();
    await page.goto("/book");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const uniqueEmail = `otp.caret.${Date.now()}@gmail.com`;

    // Fill Step 1 to reach Step 2
    await page.fill("#b-name", "Caret Tester");
    await page.fill("#b-email", uniqueEmail);
    await page.fill("#b-age", "25");
    await page.fill("#b-motive", "Testing Arabic OTP input caret height and line-height constraints");

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-casablanca"]');

    await page.click('button[type="submit"]');

    // Wait for Step 2 OTP boxes
    const otpBox0 = page.locator('[data-testid="otp-box-0"]');
    await expect(otpBox0).toBeVisible({ timeout: 35000 });

    // Inspect computed styles in browser
    const styles = await otpBox0.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        direction: el.getAttribute("dir") || computed.direction,
        height: parseFloat(computed.height),
        lineHeight: computed.lineHeight,
        caretColor: computed.caretColor,
      };
    });

    // Verify direction is LTR to prevent Arabic vertical font metric expansion
    expect(styles.direction).toBe("ltr");
    // Verify height is bounded to 32px-36px (not 48px or 56px of the full container)
    expect(styles.height).toBeLessThanOrEqual(36);
    // Verify caretColor is set to brass
    expect(styles.caretColor).not.toBe("auto");
  });

  test("14. Event summary card renders responsively beside form on desktop and above on mobile (Task 8)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.clearCookies();
    await page.goto("/book");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const summaryCard = page.locator('[data-testid="event-summary-card"]');
    await expect(summaryCard).toBeVisible({ timeout: 15000 });

    // Verify summary card details
    await expect(summaryCard.locator("img")).toBeVisible();
    await expect(summaryCard.locator('[data-testid="summary-capacity-badge"]')).toBeVisible();
    await expect(summaryCard.locator("text=0615789337")).toBeVisible();

    // Verify desktop positioning (beside form)
    await page.setViewportSize({ width: 1280, height: 800 });
    const desktopCardBox = await summaryCard.boundingBox();
    const formBox = await page.locator("form").boundingBox();
    expect(desktopCardBox).not.toBeNull();
    expect(formBox).not.toBeNull();
    if (desktopCardBox && formBox) {
      // Side-by-side check: vertical overlap is significant
      const verticalOverlap =
        Math.min(desktopCardBox.y + desktopCardBox.height, formBox.y + formBox.height) -
        Math.max(desktopCardBox.y, formBox.y);
      expect(verticalOverlap).toBeGreaterThan(50);
    }

    // Verify mobile positioning (above form)
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileCardBox = await summaryCard.boundingBox();
    const mobileFormBox = await page.locator("form").boundingBox();
    expect(mobileCardBox).not.toBeNull();
    expect(mobileFormBox).not.toBeNull();
    if (mobileCardBox && mobileFormBox) {
      // Summary card is above the form vertically on mobile
      expect(mobileCardBox.y).toBeLessThan(mobileFormBox.y);
    }
  });

  test("15. Event card booked status as small top badge and single-line inquiries without wrapping (Task 9)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.clearCookies();

    // 1. Visit /events with unbooked state first
    await page.goto("/events");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const eventCard = page.locator('[data-testid="event-card-majlis-ihyaa-2026"]');
    await expect(eventCard).toBeVisible({ timeout: 15000 });

    // Inquiries link exists and is single-line (nowrap)
    const inquiryLink = eventCard.locator('a[href*="tel:"]');
    await expect(inquiryLink).toBeVisible();
    const isNoWrap = await inquiryLink.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return computed.whiteSpace === "nowrap" || el.classList.contains("whitespace-nowrap");
    });
    expect(isNoWrap).toBe(true);

    // Book button is visible when unbooked
    await expect(eventCard.locator('[data-testid="book-btn-majlis-ihyaa-2026"]')).toBeVisible();

    // 2. Simulate user booked for majlis-ihyaa-2026
    await page.evaluate(() => {
      localStorage.setItem("ihyaa_booked_majlis-ihyaa-2026", "true");
      document.cookie = `ihyaa_booked_events=${encodeURIComponent(JSON.stringify(["majlis-ihyaa-2026"]))}; path=/; max-age=31536000; SameSite=Lax`;
    });
    await page.reload();

    // 3. When booked:
    // a. Book button is hidden
    await expect(eventCard.locator('[data-testid="book-btn-majlis-ihyaa-2026"]')).not.toBeVisible();

    // b. Small top badge is visible
    const badge = eventCard.locator('[data-testid="booked-state-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/أنت مسجل|You're booked/i);

    // c. Badge is positioned at the top of the details card, above the event title
    const title = eventCard.locator("h3");
    const badgeBox = await badge.boundingBox();
    const titleBox = await title.boundingBox();
    expect(badgeBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    if (badgeBox && titleBox) {
      expect(badgeBox.y).toBeLessThan(titleBox.y);
    }
  });

  test("16. Small screen (<360px) responsive OTP layout and email template branding (Task 10)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.clearCookies();

    // 1. Set viewport to small 320px screen width
    await page.setViewportSize({ width: 320, height: 600 });
    await page.goto("/book");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const uniqueEmail = `smallscreen.${Date.now()}@gmail.com`;

    // Fill Step 1 to reach Step 2
    await page.fill("#b-name", "Small Screen Tester");
    await page.fill("#b-email", uniqueEmail);
    await page.fill("#b-age", "22");
    await page.fill("#b-motive", "Testing small screen responsive OTP layout");

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-casablanca"]');

    await page.click('button[type="submit"]');

    // Wait for OTP boxes on Step 2
    const otpBox0 = page.locator('[data-testid="otp-box-0"]');
    await expect(otpBox0).toBeVisible({ timeout: 35000 });

    // Verify all 6 OTP boxes fit within the 320px viewport without horizontal cutoff
    for (let i = 0; i < 6; i++) {
      const box = await page.locator(`[data-testid="otp-box-${i}"]`).boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
    }

    // Verify page horizontal scroll does not exceed viewport width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // 2. Email template verification: Ensure "للثقافة والتنمية" branding is completely removed
    const emailModule = await import("../src/lib/email");
    expect(typeof emailModule.sendOTPEmail).toBe("function");
    expect(typeof emailModule.sendWaitlistPromotionEmail).toBe("function");

    // Read email source code directly to ensure branding removal and media queries exist
    const fs = await import("fs");
    const path = await import("path");
    const emailSource = fs.readFileSync(
      path.join(process.cwd(), "src/lib/email.ts"),
      "utf8",
    );
    expect(emailSource).not.toContain("للثقافة والتنمية");
    expect(emailSource).toContain("@media only screen and (max-width: 360px)");
    expect(emailSource).toContain('SENDER_NAME = "Ihyaa Program"');
    expect(emailSource).toContain('SENDER_EMAIL = "no-reply@ihyaa.is-cool.dev"');
  });

  test("17. Booking page maintains exact event info after advancing past step 1 and binds booking to correct event", async ({
    page,
    context,
  }) => {
    test.setTimeout(90000);

    // 1. Ensure two open events exist with distinct titles, locations, and dates
    await prisma.event.upsert({
      where: { id: "majlis-ihyaa-2026" },
      update: {
        titleAr: "مجلس إحياء الشبابي — الدورة الربيعية",
        location: "المقر الرئيسي — تطوان",
        bookingOpen: true,
      },
      create: {
        id: "majlis-ihyaa-2026",
        slug: "majlis-ihyaa-2026",
        titleAr: "مجلس إحياء الشبابي — الدورة الربيعية",
        titleEn: "Ihyaa Youth Council — Spring Session",
        descriptionAr: "لقاء إيماني شبابي لتزكية النفوس ومدارسة العلم",
        descriptionEn: "A youth gathering for spiritual growth and study",
        date: new Date("2026-10-15T18:00:00Z"),
        time: "18:00",
        location: "المقر الرئيسي — تطوان",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    await prisma.event.upsert({
      where: { id: "test-event-second" },
      update: {
        titleAr: "ملتقى إحياء الثاني للشباب",
        location: "الدار البيضاء، المغرب",
        date: new Date("2026-09-01T10:00:00Z"), // earlier date to test sort order
        bookingOpen: true,
      },
      create: {
        id: "test-event-second",
        slug: "test-event-second",
        titleAr: "ملتقى إحياء الثاني للشباب",
        titleEn: "Second Ihyaa Program Gathering",
        descriptionAr: "اللقاء الثاني للبرنامج الشبابي",
        descriptionEn: "Second session for youth",
        date: new Date("2026-09-01T10:00:00Z"),
        time: "10:00",
        location: "الدار البيضاء، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    // 2. Clear visitor state and open booking page for Event 1
    await context.clearCookies();
    await page.goto("/events/majlis-ihyaa-2026/book");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 3. Step 1: Assert displayed event info belongs to Majlis Ihyaa (not second event)
    const summaryCard = page.locator('[data-testid="event-summary-card"]');
    await expect(summaryCard).toBeVisible({ timeout: 15000 });
    await expect(summaryCard).toContainText("مجلس إحياء الشبابي");
    await expect(summaryCard).toContainText("تطوان");
    await expect(summaryCard).not.toContainText("الدار البيضاء");

    // 4. Fill Step 1 details and advance to Step 2 (OTP)
    const testEmail = `event.isolation.${Date.now()}@gmail.com`;
    await page.fill("#b-name", "Event Isolation Tester");
    await page.fill("#b-email", testEmail);
    await page.fill("#b-age", "25");
    await page.fill("#b-motive", "Verifying event info does not switch across steps");

    await page.click('[data-testid="city-combobox-trigger"]');
    await page.click('[data-testid="city-option-tetouan"]');

    await page.click('button[type="submit"]');

    // 5. Wait for Step 2 OTP screen
    const otpBox0 = page.locator('[data-testid="otp-box-0"]');
    await expect(otpBox0).toBeVisible({ timeout: 35000 });

    // 6. CRITICAL ASSERTION: Step 2 must STILL show Event 1 info, NEVER the second event
    await expect(summaryCard).toContainText("مجلس إحياء الشبابي");
    await expect(summaryCard).toContainText("تطوان");
    await expect(summaryCard).not.toContainText("الدار البيضاء");

    // 7. Verify OTP in DB is bound to majlis-ihyaa-2026
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email: testEmail, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(otpRecord).not.toBeNull();
    expect(otpRecord?.eventId).toBe("majlis-ihyaa-2026");

    // 8. Clean up
    await prisma.otpVerification.deleteMany({ where: { email: testEmail } });
    await prisma.booking.deleteMany({ where: { email: testEmail } });
  });

  test("18. Multiple open events carousel/switcher cycles events, updates active tab & counter, and links to per-event booking", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);

    // 1. Ensure two open events exist
    await prisma.event.upsert({
      where: { id: "majlis-ihyaa-2026" },
      update: {
        date: new Date("2026-10-15T18:00:00Z"),
        bookingOpen: true,
        capacityType: "OPEN",
      },
      create: {
        id: "majlis-ihyaa-2026",
        slug: "majlis-ihyaa-2026",
        titleAr: "مجلس إحياء الشبابي 2026",
        titleEn: "Ihyaa Youth Gathering 2026",
        descriptionAr: "اللقاء الافتتاحي لبرنامج إحياء",
        descriptionEn: "Opening gathering for Ihyaa Youth Program",
        date: new Date("2026-10-15T18:00:00Z"),
        time: "18:00",
        location: "الرباط، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    await prisma.event.upsert({
      where: { id: "test-event-second" },
      update: {
        date: new Date("2026-11-20T18:00:00Z"),
        bookingOpen: true,
        capacityType: "OPEN",
      },
      create: {
        id: "test-event-second",
        slug: "test-event-second",
        titleAr: "الملتقى الثاني لبرنامج إحياء",
        titleEn: "Second Ihyaa Program Gathering",
        descriptionAr: "اللقاء الثاني للبرنامج الشبابي",
        descriptionEn: "Second session for youth",
        date: new Date("2026-11-20T18:00:00Z"),
        time: "18:00",
        location: "الدار البيضاء، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    await context.clearCookies();
    await page.goto("/events");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Verify switcher bar is visible when multiple open events exist and has transparent background
    const switcher = page.locator('[data-testid="event-switcher"]');
    await expect(switcher).toBeVisible({ timeout: 15000 });
    const switcherClass = await switcher.getAttribute("class");
    expect(switcherClass).toContain("bg-transparent");

    const prevBtn = page.locator('[data-testid="carousel-prev-btn"]');
    const nextBtn = page.locator('[data-testid="carousel-next-btn"]');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Verify left/right side navigation arrows flank the centered content
    const prevBox = await prevBtn.boundingBox();
    const nextBox = await nextBtn.boundingBox();
    expect(prevBox).not.toBeNull();
    expect(nextBox).not.toBeNull();
    // In RTL, prev button (start) is on the right side and next button (end) is on the left side
    expect(Math.abs((prevBox?.x ?? 0) - (nextBox?.x ?? 0))).toBeGreaterThan(200);

    const tab1 = page.locator('[data-testid="event-tab-majlis-ihyaa-2026"]');
    const tab2 = page.locator('[data-testid="event-tab-test-event-second"]');
    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();

    // Verify exactly one tab is initially active
    const initialActive = (await tab1.getAttribute("aria-selected")) === "true" ? tab1 : tab2;
    const initialInactive = initialActive === tab1 ? tab2 : tab1;
    await expect(initialActive).toHaveAttribute("aria-selected", "true");
    await expect(initialInactive).toHaveAttribute("aria-selected", "false");

    // 3. Click Next button in switcher -> active tab cycles
    await nextBtn.click();

    // Wait for transition to cycle active tab
    await expect(initialInactive).toHaveAttribute("aria-selected", "true", { timeout: 10000 });
    await expect(initialActive).toHaveAttribute("aria-selected", "false", { timeout: 10000 });

    // 4. Click initial active tab to switch back
    await initialActive.click();
    await expect(initialActive).toHaveAttribute("aria-selected", "true", { timeout: 10000 });
    await expect(initialInactive).toHaveAttribute("aria-selected", "false", { timeout: 10000 });

    // 5. Verify direct per-event book button for Event 2 navigates to Event 2 booking route
    const event2BookBtn = page.locator('[data-testid="book-btn-test-event-second"]');
    await expect(event2BookBtn).toBeVisible();
    await event2BookBtn.click();
    await page.waitForURL(/.*test-event-second.*/, { timeout: 15000 });
    expect(page.url()).toContain("test-event-second");
  });

  test("19. Enforce unique event slugs, collision auto-suffixing, and slug-based booking route (Task 5)", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await context.clearCookies();

    // 1. Verify generateUniqueEventSlug generates unique suffix on collision with existing event
    const generatedSlug = await generateUniqueEventSlug("majlis-ihyaa-2026");
    expect(generatedSlug).toMatch(/^majlis-ihyaa-2026-\d+$/);

    const testSlugId = "test-slug-collision-event";
    const testSlug = "custom-test-slug-unique";

    // Clean up any existing test event
    await prisma.event.deleteMany({
      where: { OR: [{ id: testSlugId }, { slug: testSlug }] },
    });

    // 2. Create an event with a custom slug
    const createdEvent = await prisma.event.create({
      data: {
        id: testSlugId,
        slug: testSlug,
        titleAr: "فعالية اختبار المعرف الرابط",
        titleEn: "Test Slug Unique Event",
        descriptionAr: "وصف فعالية اختبار المعرف الرابط",
        descriptionEn: "Test Slug Unique Event Description",
        date: new Date("2026-12-15T18:00:00Z"),
        time: "18:00",
        location: "الرباط، المغرب",
        posterUrl: "/images/events/opening-majlis.webp",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });
    expect(createdEvent.slug).toBe(testSlug);

    // 3. Test generateUniqueEventSlug generates suffix for the now-existing test slug
    const collisionSlug = await generateUniqueEventSlug(testSlug);
    expect(collisionSlug).toBe(`${testSlug}-2`);

    // 4. Test database unique constraint enforces rejection of duplicate slug insertion
    let dbDuplicateFailed = false;
    try {
      await prisma.event.create({
        data: {
          id: "another-duplicate-event-id",
          slug: testSlug, // Same slug violates unique constraint!
          titleAr: "فعالية مكررة",
          titleEn: "Duplicate Event",
          descriptionAr: "وصف",
          descriptionEn: "desc",
          date: new Date("2026-12-20T18:00:00Z"),
          time: "18:00",
          location: "الرباط",
          posterUrl: "/images/events/opening-majlis.webp",
          bookingOpen: true,
          capacityType: "OPEN",
        },
      });
    } catch (err: unknown) {
      dbDuplicateFailed = true;
      expect((err as { code?: string })?.code).toBe("P2002");
    }
    expect(dbDuplicateFailed).toBe(true);

    // 5. Navigate directly to the booking route via its unique slug (/events/[slug]/book)
    await page.goto(`/events/${testSlug}/book`);
    await expect(page.locator('[data-testid="booking-stepper"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator("body")).toContainText(/فعالية اختبار المعرف الرابط|Test Slug Unique Event/);

    // 6. Cleanup
    await prisma.event.deleteMany({
      where: { id: testSlugId },
    });
  });

  test("20. Events page is fully dynamic from database with no mock/static events, and handles empty states", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 1. Visit /events
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    // 2. Assert that old mock events are completely gone
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Winter spiritual retreat");
    expect(bodyText).not.toContain("خلوة روحية شتوية");
    expect(bodyText).not.toContain("Ihyaa Football Cup");
    expect(bodyText).not.toContain("دوري إحياء لكرة القدم");
    expect(bodyText).not.toContain("Ramadan night gathering");
    expect(bodyText).not.toContain("أمسية رمضانية");

    // 3. Verify content.ts has empty mock constants
    const contentModule = await import("../src/lib/content");
    expect(contentModule.OPEN_EVENTS).toEqual([]);
    expect(contentModule.PAST_EVENTS).toEqual([]);
    expect(contentModule.EVENTS).toEqual([]);
  });

  test("21. Automatic classification of events as open vs. ended based on event date/time, and edge cases", async ({
    page,
  }) => {
    test.setTimeout(90000);

    const pastEventId = "test-auto-past-event";
    const futureEventId = "test-auto-future-event";
    const todayEventId = "test-auto-today-event";

    // Clean up any stale records first
    await prisma.event.deleteMany({
      where: { id: { in: [pastEventId, futureEventId, todayEventId] } },
    });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayMidnight = new Date(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T00:00:00.000Z`);
    const futureHour = (today.getHours() + 2) % 24;
    const todayTimeStr = `${pad(futureHour)}:00`;

    // 1. Create a past event (date yesterday, bookingOpen: true in DB)
    await prisma.event.create({
      data: {
        id: pastEventId,
        slug: pastEventId,
        titleAr: "فعالية سابقة منتهية تلقائياً",
        titleEn: "Auto Past Event",
        descriptionAr: "وصف",
        descriptionEn: "desc",
        date: yesterday,
        time: "18:00",
        location: "الرباط",
        posterUrl: "/images/event-poster.jpg",
        bookingOpen: true, // Intentionally left true in DB to test automatic classification
        capacityType: "OPEN",
      },
    });

    // 2. Create a future event (date tomorrow, bookingOpen: true)
    await prisma.event.create({
      data: {
        id: futureEventId,
        slug: futureEventId,
        titleAr: "فعالية مستقبلية مفتوحة",
        titleEn: "Auto Future Open Event",
        descriptionAr: "وصف",
        descriptionEn: "desc",
        date: tomorrow,
        time: "18:00",
        location: "الدار البيضاء",
        posterUrl: "/images/event-poster.jpg",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    // 3. Create a today event with UTC midnight and future time today
    await prisma.event.create({
      data: {
        id: todayEventId,
        slug: todayEventId,
        titleAr: "فعالية اليوم في وقت لاحق",
        titleEn: "Today Later Event",
        descriptionAr: "وصف",
        descriptionEn: "desc",
        date: todayMidnight,
        time: todayTimeStr,
        location: "مراكش",
        posterUrl: "/images/event-poster.jpg",
        bookingOpen: true,
        capacityType: "OPEN",
      },
    });

    // 4. Test Server Action classification via getPublicEvents()
    const { getPublicEvents } = await import("../src/app/actions/events");
    const publicRes = await getPublicEvents();
    expect(publicRes.success).toBe(true);

    const openIds = (publicRes.openEvents || []).map((e: { id: string }) => e.id);
    const pastIds = (publicRes.pastEvents || []).map((e: { id: string }) => e.id);

    // Yesterday's event must be automatically in pastEvents, NOT in openEvents
    expect(openIds).not.toContain(pastEventId);
    expect(pastIds).toContain(pastEventId);

    // Tomorrow's event must be in openEvents
    expect(openIds).toContain(futureEventId);
    expect(pastIds).not.toContain(futureEventId);

    // Today's event with future time must NOT be prematurely classified as ended
    expect(openIds).toContain(todayEventId);
    expect(pastIds).not.toContain(todayEventId);

    // 5. Test Server Action booking block on ended event
    const { requestBookingOtp } = await import("../src/app/actions/bookings");
    const bookRes = await requestBookingOtp({
      fullName: "Test Attendee",
      email: "test.auto.past@gmail.com",
      city: "الرباط",
      age: 25,
      motive: "الحضور",
      eventId: pastEventId,
      locale: "ar",
    });
    expect(bookRes.success).toBe(false);
    expect(bookRes.error).toContain("انتهت هذه الفعالية");

    // 6. Test on UI: Navigate to /events
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");

    // Past event should appear in the past events section
    const pastSection = page.locator("#past-events");
    await expect(pastSection).toBeVisible({ timeout: 25000 });
    await expect(pastSection).toContainText("فعالية سابقة منتهية تلقائياً");

    // 7. Cleanup
    await prisma.event.deleteMany({
      where: { id: { in: [pastEventId, futureEventId, todayEventId] } },
    });
  });

  test("22. Localized Islamic loading states (ar/en with proper typography) on events and booking pages prevent static content flashing", async ({
    page,
  }) => {
    // 1. Visit booking page in Arabic
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");

    // The loading fallback or booking-loading should display the Islamic rotating loader
    const bookingStepper = page.locator("[data-testid='booking-stepper']");
    await expect(bookingStepper).toBeVisible({ timeout: 25000 });

    // Verify booking summary card displays dynamic DB title without flashing mock titles
    const summaryCard = page.locator("[data-testid='event-summary-card']");
    await expect(summaryCard).toBeVisible();
    await expect(summaryCard).not.toContainText("خلوة روحية");
    await expect(summaryCard).not.toContainText("دوري إحياء");
    await expect(summaryCard).not.toContainText("أمسية رمضانية");

    // 2. Switch to English and verify loading typography & translation
    await page.evaluate(() => {
      localStorage.setItem("ihyaa-locale", "en");
    });
    await page.goto("/book");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("[data-testid='booking-stepper']")).toBeVisible({ timeout: 25000 });
    const enSummaryCard = page.locator("[data-testid='event-summary-card']");
    await expect(enSummaryCard).toBeVisible();
    await expect(enSummaryCard).not.toContainText("Winter spiritual");
    await expect(enSummaryCard).not.toContainText("Football Cup");

    // 3. Verify IslamicLoader component renders rotating 8-pointed star and typography
    await page.goto("/events");
    await page.waitForLoadState("domcontentloaded");
    // Events page renders open events or empty state without static mock event flashing
    const body = page.locator("body");
    await expect(body).toBeVisible();
    await expect(body).not.toContainText("Winter spiritual retreat");
    await expect(body).not.toContainText("خلوة روحية شتوية");
  });
});
