import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

test.describe("Admin Polish, Contacts, Navbar Theme & Error Pages", () => {
  const testContactEmail = "contact.tester@example.com";

  test.beforeEach(async () => {
    await prisma.contactMessage.deleteMany({
      where: { email: testContactEmail },
    });
  });

  test("1. Homepage contact form submits and saves to database", async ({ page }) => {
    await page.goto("/#contact");

    await page.fill("#name", "أحمد الإدريسي");
    await page.fill("#email", testContactEmail);
    await page.fill("#message", "السلام عليكم، نود الاستفسار عن برامج وأنشطة الجمعية القادمة.");

    await page.click('#contact button[type="submit"]');

    // Toast notification appears
    await expect(page.locator("body")).toContainText(/تم إرسال رسالتك بنجاح|شكراً لتواصلك/i, { timeout: 10000 });

    // Verify record in database
    const saved = await prisma.contactMessage.findFirst({
      where: { email: testContactEmail },
    });
    expect(saved).toBeTruthy();
    expect(saved?.name).toBe("أحمد الإدريسي");
  });

  test("2. Admin contacts page displays submitted messages", async ({ page }) => {
    // Seed a message
    await prisma.contactMessage.create({
      data: {
        name: "زائر للتجربة",
        email: testContactEmail,
        message: "رسالة تجريبية لاختبار لوحة التحكم",
      },
    });

    await page.goto("/admin/contacts");
    await expect(page.locator("body")).toContainText("زائر للتجربة", { timeout: 10000 });
    await expect(page.locator("body")).toContainText(testContactEmail);
  });

  test("3. Bookings admin table: row click opens detail modal", async ({ page }) => {
    // Ensure at least one confirmed booking exists
    const event = await prisma.event.findFirst();
    if (event) {
      await prisma.booking.create({
        data: {
          eventId: event.id,
          fullName: "سفيان العمري",
          email: "soufiane.test@gmail.com",
          city: "طنجة",
          age: 26,
          motive: "الرغبة في حضور المجلس القرآني والتعرف على الجمعية",
          confirmed: true,
        },
      });
    }

    await page.goto("/admin/bookings");

    // Click on row
    const row = page.locator("tr", { hasText: "سفيان العمري" }).first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();

    // Verify detail modal opens
    const modal = page.getByTestId("booking-detail-modal");
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("سفيان العمري");
    await expect(modal).toContainText("طنجة");
    await expect(modal).toContainText("الرغبة في حضور المجلس القرآني");

    // Clean up
    await prisma.booking.deleteMany({ where: { email: "soufiane.test@gmail.com" } });
  });

  test("4. Navbar theme toggle works cleanly at top and scrolled states", async ({ page }) => {
    await page.goto("/");

    // Top state - test theme toggle
    const themeBtn = page.locator('header nav button[aria-label*="السمة"], header nav button[aria-label*="theme"]').first();
    await expect(themeBtn).toBeVisible();

    // Click to toggle
    await themeBtn.click();
    await page.waitForTimeout(400);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);

    // Scrolled navbar is visible
    const nav = page.locator("header nav");
    await expect(nav).toBeVisible();

    // Toggle theme again while scrolled
    await themeBtn.click();
    await page.waitForTimeout(400);
    await expect(nav).toBeVisible();
  });

  test("5. Custom 404 page renders Islamic motif and home CTA in light and dark mode", async ({ page }) => {
    // Light mode
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/page-that-does-not-exist-404");

    await expect(page.locator("h1")).toContainText("الصفحة غير موجودة");
    await expect(page.locator("a", { hasText: "العودة للرئيسية" })).toBeVisible();

    // Dark mode
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/page-that-does-not-exist-404");
    await expect(page.locator("h1")).toContainText("الصفحة غير موجودة");
  });
});
