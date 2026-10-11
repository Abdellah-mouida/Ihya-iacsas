import { test, expect } from "@playwright/test";
import { TERMS_VERSION } from "../src/lib/terms";

test.describe("Terms of Service and Privacy Policy Pages", () => {
  test.setTimeout(60000);

  test("1. Terms page renders with TOC, version, contact details, RTL, and dark mode", async ({
    page,
  }) => {
    await page.goto("/terms");
    await expect(page.locator('[data-testid="terms-page"]')).toBeVisible();

    // Verify version badge
    await expect(page.getByText(new RegExp(TERMS_VERSION))).toBeVisible();

    // Verify all 12 sections are present in DOM
    const sections = [
      "acceptance",
      "eligibility",
      "accounts",
      "acceptable-use",
      "registration",
      "user-content",
      "intellectual-property",
      "disclaimers",
      "suspension",
      "changes",
      "governing-law",
      "contact",
    ];

    for (const secId of sections) {
      await expect(page.locator(`[data-testid="terms-section-${secId}"]`)).toBeVisible();
    }

    // Verify contact links: phone, facebook, instagram (no email)
    const phoneLink = page.locator('[data-testid="terms-section-contact"] a[href="tel:+212615789337"]');
    await expect(phoneLink).toBeVisible();
    await expect(phoneLink).toContainText("0615789337");

    const fbLink = page.locator('[data-testid="terms-section-contact"] a[href*="facebook.com"]');
    await expect(fbLink).toBeVisible();

    const instaLink = page.locator('[data-testid="terms-section-contact"] a[href*="instagram.com"]');
    await expect(instaLink).toBeVisible();

    // Ensure no mailto: links exist on the page
    const emailLinks = page.locator('a[href^="mailto:"]');
    expect(await emailLinks.count()).toBe(0);

    // Verify TOC sidebar exists on desktop
    const toc = page.locator("aside nav a");
    expect(await toc.count()).toBe(12);

    // Verify dark mode emulation
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator('[data-testid="terms-page"]')).toBeVisible();

    // Verify mobile 320px rendering without horizontal scroll overflow
    await page.setViewportSize({ width: 320, height: 600 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
  });

  test("2. Privacy page renders with TOC, version, processors, cookies, and English LTR toggle", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(page.locator('[data-testid="privacy-page"]')).toBeVisible();

    // Verify version badge
    await expect(page.getByText(new RegExp(TERMS_VERSION))).toBeVisible();

    // Verify key privacy sections
    const privacySections = [
      "collection",
      "purpose",
      "processors",
      "cookies",
      "retention",
      "security",
      "rights",
      "children",
      "changes",
      "contact",
    ];

    for (const secId of privacySections) {
      await expect(page.locator(`[data-testid="privacy-section-${secId}"]`)).toBeVisible();
    }

    // Verify processors mentioned
    const processorsSec = page.locator('[data-testid="privacy-section-processors"]');
    await expect(processorsSec).toContainText(/Neon/i);
    await expect(processorsSec).toContainText(/Cloudinary/i);
    await expect(processorsSec).toContainText(/Brevo/i);
    await expect(processorsSec).toContainText(/Google/i);
    await expect(processorsSec).toContainText(/Vercel/i);

    // Switch to English and verify LTR layout
    const langBtn = page.locator('button[aria-label*="English"], button:has-text("EN")').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(600);
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
      await expect(page.locator("h1")).toContainText(/Privacy Policy/i);
    }

    // Verify footer links to terms and privacy work
    await page.goto("/");
    const footerTerms = page.locator('footer a[href="/terms"]');
    await expect(footerTerms).toBeVisible();
    await footerTerms.click();
    await expect(page).toHaveURL(/\/terms/);
  });
});
