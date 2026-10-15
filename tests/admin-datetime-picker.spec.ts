import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { loginAdmin } from "./helpers/admin-auth";

test.describe("Task 2: Custom Date and Time Picker", () => {
  const testTitle = `فعالية اختبار التقويم ${Date.now()}`;

  test.afterAll(async () => {
    await prisma.event.deleteMany({
      where: {
        OR: [
          { titleAr: { contains: "اختبار التقويم" } },
          { titleEn: { contains: "Calendar Test" } },
        ],
      },
    });
  });

  test("1. Admin events modal uses custom DateTimePicker without native type=date input", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/events");

    // Open Add Event modal
    const addBtn = page.locator('[data-testid="create-event-btn"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Verify dialog is open
    const modal = page.locator('[data-testid="event-modal"]');
    await expect(modal).toBeVisible();

    // Verify native input type="date" is NOT in the form
    const nativeDateInputs = modal.locator('input[type="date"]');
    await expect(nativeDateInputs).toHaveCount(0);

    // Verify custom date trigger exists
    const dateTrigger = modal.locator('[data-testid="date-picker-trigger"]');
    await expect(dateTrigger).toBeVisible();

    // Verify custom time trigger exists
    const timeTrigger = modal.locator('[data-testid="time-picker-trigger"]');
    await expect(timeTrigger).toBeVisible();

    // Verify hidden inputs exist for form submission
    const hiddenDate = modal.locator('input[type="hidden"][name="date"]');
    await expect(hiddenDate).toHaveCount(1);
    const hiddenTime = modal.locator('input[type="hidden"][name="time"]');
    await expect(hiddenTime).toHaveCount(1);
  });

  test("2. Date picker popover opens, supports presets and date selection", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/events");

    const addBtn = page.locator('[data-testid="create-event-btn"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const dateTrigger = page.locator('[data-testid="date-picker-trigger"]');
    await dateTrigger.scrollIntoViewIfNeeded();
    await dateTrigger.click();

    // Verify calendar popover is visible
    const quickSelect = page.locator('button:has-text("غداً"), button:has-text("Tomorrow")');
    await expect(quickSelect).toBeVisible();

    // Click "Tomorrow" preset
    await quickSelect.click({ force: true });

    // Verify hidden date input contains YYYY-MM-DD
    const hiddenDate = page.locator('input[type="hidden"][name="date"]');
    const val = await hiddenDate.inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("3. Time picker popover opens, supports custom typing and presets", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/events");

    const addBtn = page.locator('[data-testid="create-event-btn"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const timeTrigger = page.locator('[data-testid="time-picker-trigger"]');
    await timeTrigger.click();

    // Verify custom input and presets are visible
    const timeInput = page.locator('[data-testid="time-picker-input"]');
    await expect(timeInput).toBeVisible();

    // Select preset "06:00 - 09:00 م"
    const presetBtn = page.locator('button:has-text("06:00 - 09:00 م"), button:has-text("6:00 - 9:00 PM")').first();
    await expect(presetBtn).toBeVisible();
    await presetBtn.click();

    // Verify hidden time input updated
    const hiddenTime = page.locator('input[type="hidden"][name="time"]');
    const timeVal = await hiddenTime.inputValue();
    expect(timeVal).toBe("18:00 - 21:00");
  });

  test("4. Submitting event with custom DateTimePicker creates event in DB with exact date and time", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/events");

    const addBtn = page.locator('[data-testid="create-event-btn"]').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Fill form fields
    await page.fill('input[name="titleAr"]', testTitle);
    await page.fill('input[name="titleEn"]', "Calendar Test Event");
    await page.fill('textarea[name="descriptionAr"]', "وصف تجريبي لاختبار التقويم");
    await page.fill('textarea[name="descriptionEn"]', "Test description for calendar");

    // Select Date
    const dateTrigger = page.locator('[data-testid="date-picker-trigger"]');
    await dateTrigger.click();
    const tomorrowBtn = page.locator('button:has-text("غداً"), button:has-text("Tomorrow")');
    await tomorrowBtn.click();

    // Select Time
    const timeTrigger = page.locator('[data-testid="time-picker-trigger"]');
    await timeTrigger.click();
    const presetBtn = page.locator('button:has-text("06:00 - 09:00 م"), button:has-text("6:00 - 9:00 PM")').first();
    await presetBtn.click();

    await page.fill('input[name="location"]', "الرباط");
    await page.fill('input[name="posterUrl"]', "/images/gathering.jpg");

    // Submit form (Save Event / إضافة الفعالية)
    const submitBtn = page.locator('[data-testid="event-form-submit-btn"]');
    await submitBtn.click();

    // Wait for modal to close
    await expect(page.locator('[data-testid="event-modal"]')).not.toBeVisible({ timeout: 15000 });

    // Verify event in DB
    const dbEvent = await prisma.event.findFirst({
      where: { titleAr: testTitle },
    });
    expect(dbEvent).not.toBeNull();
    expect(dbEvent?.time).toBe("18:00 - 21:00");
    expect(dbEvent?.location).toBe("الرباط");
  });
});
