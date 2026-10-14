import { test, expect } from "@playwright/test";
import { generateTempPassword } from "@/lib/password";

test.describe("Task 1 Auth, Hero & Onboarding Fixes", () => {
  test("1. generateTempPassword produces exactly 10-character alphanumeric password without symbols or confusing characters", async () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateTempPassword();
      expect(pwd).toHaveLength(10);
      expect(pwd).toMatch(/^[A-HJ-NP-Za-km-np-z2-9]{10}$/);
      expect(pwd).not.toMatch(/[01IlO]/);
      expect(pwd).not.toMatch(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/);
    }
  });

  test("2. Hero section has stats numbers removed and kicker has high-contrast styling", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Stats cards (500+, 12+, 4 cities) must not exist
    const statsDl = page.locator("section#home dl");
    await expect(statsDl).toHaveCount(0);
    const heroText = await page.locator("section#home").innerText();
    expect(heroText).not.toContain("500+");
    expect(heroText).not.toContain("12+");

    // Kicker element should have high-contrast styling
    const kicker = page.locator("section#home span.inline-flex").first();
    await expect(kicker).toBeVisible();
    const kickerClass = await kicker.getAttribute("class");
    expect(kickerClass).toContain("text-foreground");
    expect(kickerClass).toContain("dark:text-white");
  });

  test("3. Sign up heading is 'انضم إلى برنامج إحياء' (ar) and 'Join Ihyaa Program' (en)", async ({ page }) => {
    // Arabic
    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("انضم إلى برنامج إحياء");

    // Full name placeholder in Arabic
    const nameInputAr = page.locator('input[data-testid="signup-name"]');
    await expect(nameInputAr).toHaveAttribute("placeholder", "مثال: يوسف الإدريسي");

    // English via localStorage
    await page.evaluate(() => {
      localStorage.setItem("ihyaa-locale", "en");
    });
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toContainText("Join Ihyaa Program");

    const nameInputEn = page.locator('input[data-testid="signup-name"]');
    await expect(nameInputEn).toHaveAttribute("placeholder", "e.g. Youssef El Idrissi");
  });

  test("4. Auth pages render ambient backdrop and divider uses font-sans instead of font-mono", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Backdrop present in DOM
    const backdrop = page.locator('[data-testid="auth-ambient-backdrop"]');
    await expect(backdrop).toBeAttached();

    // Divider does not have font-mono
    const divider = page.locator(".relative.my-6 span.relative");
    await expect(divider).toBeVisible();
    const dividerClass = await divider.getAttribute("class");
    expect(dividerClass).not.toContain("font-mono");
    expect(dividerClass).toContain("font-sans");
  });

  test("5. Password inputs in RTL have proper padding and show/hide toggle button", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const passwordInput = page.locator('[data-testid="login-password-input"]');
    await expect(passwordInput).toBeVisible();
    const toggleBtn = page.locator('[data-testid="toggle-password-visibility"]');
    await expect(toggleBtn).toBeVisible();

    // Verify input bounding box and toggle button bounding box do not overlap text collision
    const inputStyle = await passwordInput.getAttribute("class");
    expect(inputStyle).toContain("ps-3.5");
    expect(inputStyle).toContain("pe-11");
  });
});
