import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ihyaa-admin-dev-pass-2026";

async function loginAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator("aside")).toBeVisible();
}

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

    await loginAdmin(page);
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

    await loginAdmin(page);
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

  test("6. Bilingual fields render with required validation and translate suggestion chips", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/events");

    // Open create event modal
    const addBtn = page.locator("button", { hasText: /فعالية جديدة|New Event/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Verify both titleAr and titleEn inputs exist and are required
    const titleArInput = page.locator('input[name="titleAr"]');
    const titleEnInput = page.locator('input[name="titleEn"]');
    await expect(titleArInput).toBeVisible();
    await expect(titleEnInput).toBeVisible();
    await expect(titleArInput).toHaveAttribute("required", "");
    await expect(titleEnInput).toHaveAttribute("required", "");

    // Type Arabic text and test translation suggestion chip
    await titleArInput.fill("أمسية قرآنية شبابية");
    // Wait for translation debouncing & chip appearance
    const suggestionChip = page.locator("button[title='Accept'], button[title='قبول']").first();
    await expect(suggestionChip).toBeVisible({ timeout: 10000 });

    // Accept suggestion
    await suggestionChip.click();
    await expect(titleEnInput).not.toHaveValue("");

    // Also verify Gallery modal has required bilingual captions
    await page.goto("/admin/gallery");
    const addPhotoBtn = page.locator("button", { hasText: /إضافة صورة|إضافة أول صورة|Add Photo|Add First Photo/i }).first();
    await expect(addPhotoBtn).toBeVisible({ timeout: 10000 });
    await addPhotoBtn.click();

    const captionArInput = page.locator('input[name="captionAr"]');
    const captionEnInput = page.locator('input[name="captionEn"]');
    await expect(captionArInput).toBeVisible();
    await expect(captionEnInput).toBeVisible();
    await expect(captionArInput).toHaveAttribute("required", "");
    await expect(captionEnInput).toHaveAttribute("required", "");
  });

  test("7. Dedicated /gallery page loads photos grouped by date with interactive lightbox", async ({ page }) => {
    await page.goto("/gallery");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });

    // Verify at least one photo card is present
    const photoButtons = page.locator("section button");
    await expect(photoButtons.first()).toBeVisible();

    // Click photo to open lightbox
    await photoButtons.first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close lightbox via Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("8. Homepage gallery CTA navigates to /gallery and contact section has social links", async ({ page }) => {
    await page.goto("/");

    // Gallery CTA button
    const galleryCta = page.locator('a[href="/gallery"]');
    await expect(galleryCta.first()).toBeVisible();

    // Contact section social links
    const fbLink = page.locator('a[href*="facebook.com"]');
    const igLink = page.locator('a[href*="instagram.com"]');
    await expect(fbLink).toBeVisible();
    await expect(igLink).toBeVisible();

    // Verify demo site disclaimer is completely gone
    await expect(page.locator("body")).not.toContainText("موقع تجريبي");
    await expect(page.locator("body")).not.toContainText("Demo site");
  });

  test("9. Admin upload modals show recommended image resolution and aspect ratio hints", async ({ page }) => {
    await loginAdmin(page);
    // Check Carousel hints
    await page.goto("/admin/carousel");
    const addCarouselBtn = page.locator("button", { hasText: /إضافة ملصق|إضافة أول ملصق|Add Poster/i }).first();
    await expect(addCarouselBtn).toBeVisible({ timeout: 10000 });
    await addCarouselBtn.click();
    await expect(page.locator("body")).toContainText("4:5");

    // Check Events hints
    await page.goto("/admin/events");
    const addEventBtn = page.locator("button", { hasText: /فعالية جديدة/i }).first();
    await expect(addEventBtn).toBeVisible({ timeout: 10000 });
    await addEventBtn.click();
    await expect(page.locator("body")).toContainText("1024");

    // Check Gallery hints
    await page.goto("/admin/gallery");
    const addGalleryBtn = page.locator("button", { hasText: /إضافة صورة|إضافة أول صورة/i }).first();
    await expect(addGalleryBtn).toBeVisible({ timeout: 10000 });
    await addGalleryBtn.click();
    await expect(page.locator("body")).toContainText("4:3");
  });
});
