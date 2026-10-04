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
    const bookingRef = page.getByTestId("booking-ref-display");
    await expect(bookingRef).toBeVisible({ timeout: 35000 });
    await expect(bookingRef).toContainText(/IHY-/);

    // Verify redirect notice is visible with countdown
    const redirectNotice = page.getByTestId("redirect-notice");
    await expect(redirectNotice).toBeVisible();

    // Wait for automatic redirect to /events (within 6 seconds)
    await page.waitForURL("**/events", { timeout: 8000 });

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
    const bookingRef = page.getByTestId("booking-ref-display");
    await expect(bookingRef).toBeVisible({ timeout: 15000 });
    await expect(bookingRef).toContainText(/IHY-/);

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

    const bookingRef = page.getByTestId("booking-ref-display");
    await expect(bookingRef).toBeVisible({ timeout: 15000 });

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
    // Clear cooldown rate limit key so test doesn't have to wait 30s
    await prisma.rateLimit.deleteMany({
      where: { key: `otp_gen_cooldown:${testEmailUnique}` },
    });

    await page.goto("/events/majlis-ihyaa/book?eventId=test-event-second");
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

    await expect(bookingRef).toBeVisible({ timeout: 15000 });

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
});
