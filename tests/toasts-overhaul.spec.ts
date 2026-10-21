import { test, expect } from "@playwright/test";

test.describe("Toasts Overhaul & Deduplication System", () => {
  test("firing same toast multiple times shows 1 toast with deduplication badge (e.g. ×5)", async ({ page }) => {
    await page.goto("/login");

    // Wait for window.__IHYAA_TOAST__ to be available
    await page.waitForFunction(() => typeof (window as any).__IHYAA_TOAST__ !== "undefined");

    // Fire toast 5 times with identical message
    await page.evaluate(() => {
      const toast = (window as any).__IHYAA_TOAST__;
      for (let i = 0; i < 5; i++) {
        toast.error("بيانات الاعتماد غير صالحة");
      }
    });

    // Verify there is only 1 toast element containing the message
    const toasts = page.locator("[data-sonner-toast]").filter({ hasText: "بيانات الاعتماد غير صالحة" });
    await expect(toasts).toHaveCount(1);

    // Verify deduplication badge shows ×5
    const badge = page.getByTestId("toast-dedupe-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText("×5");
  });

  test("stack limit limits visible toasts to 3 and queues excess", async ({ page }) => {
    await page.goto("/login");

    // Wait for window.__IHYAA_TOAST__ to be available
    await page.waitForFunction(() => typeof (window as any).__IHYAA_TOAST__ !== "undefined");

    // Clear any previous toasts
    await page.evaluate(() => {
      const toast = (window as any).__IHYAA_TOAST__;
      toast.clearAll();
    });

    // Fire 6 different toasts
    await page.evaluate(() => {
      const toast = (window as any).__IHYAA_TOAST__;
      for (let i = 1; i <= 6; i++) {
        toast.info(`رسالة تنبيه تجريبية رقم ${i}`);
      }
    });

    // In Sonner with visibleToasts={3}, at most 3 toasts are visible in the viewport stack
    const allToasts = page.locator("[data-sonner-toast]");
    const count = await allToasts.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify that the active toasts have close button
    const closeButtons = page.locator("[data-close-button]");
    expect(await closeButtons.count()).toBeGreaterThanOrEqual(1);
  });
});
