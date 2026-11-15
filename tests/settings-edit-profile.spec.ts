import { test, expect, devices, type Page } from "@playwright/test";
import { prisma } from "../src/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

assertDevBranchDatabase("Settings edit-profile and mobile typing tests");

async function signInToSettings(page: Page, user: { email: string; password: string }) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent("/settings")}`);
  await page.locator('[data-testid="login-email-input"]').fill(user.email);
  await page.locator('[data-testid="login-password-input"]').fill(user.password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await page.waitForURL(/\/settings/, { timeout: 25_000 });
  await expect(page.locator('[data-testid="settings-profile-section"]')).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("Edit profile save, session sync, bio line breaks, and phone typing", () => {
  test.setTimeout(90_000);

  test("saves edits to DB, refreshes session, keeps bio newlines, and redirects to /profile", async ({
    page,
  }) => {
    const user = await createSyntheticUser("Settings save & bio test");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        city: "الرباط",
        age: 22,
        onboardingCompletedAt: new Date(),
      },
    });

    try {
      await signInToSettings(page, user);

      // Invalid age triggers clear error toast and stays on /settings
      await page.locator('[data-testid="settings-age-input"]').fill("5");
      await page.locator('[data-testid="settings-save-profile-btn"]').click();
      await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 10_000 });
      expect(page.url()).toContain("/settings");

      // Valid edit with multi-line bio (4 newlines collapsed to max 2 blank lines = \n\n\n)
      const updatedName = "يوسف المحدث";
      const rawBio = "السطر الأول\nالسطر الثاني\n\n\n\nالسطر الثالث";
      const expectedBio = "السطر الأول\nالسطر الثاني\n\n\nالسطر الثالث";

      await page.locator('[data-testid="settings-name-input"]').fill(updatedName);
      await page.locator('[data-testid="settings-age-input"]').fill("25");
      await page.locator('[data-testid="city-combobox-trigger"]').click();
      await page.locator('[data-testid="city-option-casablanca"]').click();
      await page.locator('[data-testid="settings-bio-input"]').fill(rawBio);

      await page.locator('[data-testid="settings-save-profile-btn"]').click();
      await page.waitForURL(/\/profile(?:\?|$)/, { timeout: 20_000 });

      await expect(page.locator('[data-testid="profile-glass-name"]')).toContainText(updatedName);

      // Verify bio rendering preserves newlines and wrapping rules
      const bioBlock = page.locator('[data-testid="profile-bio-card"] blockquote');
      await expect(bioBlock).toBeVisible();
      const bioStyles = await bioBlock.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          whiteSpace: cs.whiteSpace,
          overflowWrap: cs.overflowWrap,
          text: el.textContent || "",
        };
      });
      expect(bioStyles.whiteSpace).toBe("pre-line");
      expect(bioStyles.overflowWrap).toBe("anywhere");
      expect(bioStyles.text).toContain(expectedBio);

      // Verify navbar session updated without a full page reload
      await page.locator('[data-testid="navbar-user-menu-btn"]').click();
      await expect(page.getByText(updatedName).first()).toBeVisible();

      // Verify DB row directly
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, age: true, bio: true },
      });
      expect(dbUser).toEqual({ name: updatedName, age: 25, bio: expectedBio });
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await removeSyntheticUser(user.id);
    }
  });

  test("phone profile: inputs >= 16px, balanced padding, and IME composition typing persists", async ({
    browser,
  }) => {
    const user = await createSyntheticUser("Settings mobile composition test");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        city: "الرباط",
        age: 22,
        onboardingCompletedAt: new Date(),
      },
    });
    const baseURL = String(test.info().project.use.baseURL || "http://127.0.0.1:3001");
    const context = await browser.newContext({
      ...devices["Pixel 5"],
      baseURL,
    });

    try {
      const page = await context.newPage();
      await signInToSettings(page, user);

      // Check field dimensions & >=16px font-size on phone
      const fieldMetrics = await page.evaluate(() => {
        const selectors = [
          '[data-testid="settings-name-input"]',
          '[data-testid="city-combobox-trigger"]',
          '[data-testid="settings-age-input"]',
          '[data-testid="settings-studylevel-input"]',
          '[data-testid="settings-institution-input"]',
          '[data-testid="settings-bio-input"]',
        ];
        return selectors.map((sel) => {
          const el = document.querySelector(sel) as HTMLElement;
          const cs = getComputedStyle(el);
          const ph = getComputedStyle(el, "::placeholder");
          const rect = el.getBoundingClientRect();
          return {
            sel,
            height: rect.height,
            fontSize: parseFloat(cs.fontSize),
            placeholderFontSize: parseFloat(ph.fontSize) || parseFloat(cs.fontSize),
            paddingInlineStart: parseFloat(cs.paddingInlineStart),
            paddingTop: parseFloat(cs.paddingTop),
          };
        });
      });

      for (const m of fieldMetrics) {
        expect(m.height, `${m.sel} height`).toBeGreaterThanOrEqual(44);
        expect(m.fontSize, `${m.sel} fontSize`).toBeGreaterThanOrEqual(16);
        expect(m.placeholderFontSize, `${m.sel} placeholder size`).toBe(m.fontSize);
        expect(m.paddingInlineStart, `${m.sel} horizontal padding`).toBeGreaterThanOrEqual(14);
      }

      // Tap name field and dispatch Android IME composition + input events
      const nameInput = page.locator('[data-testid="settings-name-input"]');
      await nameInput.scrollIntoViewIfNeeded();
      await nameInput.tap();
      await nameInput.evaluate((el) => {
        const input = el as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
        setter.call(input, "سلمى");
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: "سلمى",
            inputType: "insertCompositionText",
            isComposing: true,
          }),
        );
        input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "سلمى" }));
        setter.call(input, "سلمى العمراني");
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: " العمراني",
            inputType: "insertText",
            isComposing: false,
          }),
        );
      });

      await page.waitForTimeout(250);
      await expect(nameInput).toHaveValue("سلمى العمراني");

      // Also compose into bio textarea
      const bioInput = page.locator('[data-testid="settings-bio-input"]');
      await bioInput.scrollIntoViewIfNeeded();
      await bioInput.tap();
      await bioInput.evaluate((el) => {
        const ta = el as HTMLTextAreaElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
        ta.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
        setter.call(ta, "سطر أول\nسطر ثاني");
        ta.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: "سطر أول\nسطر ثاني",
            inputType: "insertCompositionText",
            isComposing: true,
          }),
        );
        ta.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "سطر أول\nسطر ثاني" }));
      });
      await page.waitForTimeout(250);
      await expect(bioInput).toHaveValue("سطر أول\nسطر ثاني");
    } finally {
      await context.close();
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await removeSyntheticUser(user.id);
    }
  });
});
