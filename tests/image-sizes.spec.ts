import { test, expect } from "@playwright/test";

test.describe("Task 5: Next.js Image sizes fix on hero and about", () => {
  test("hero and about images have accurate responsive sizes attributes and load without console warnings", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning" || msg.type() === "error") {
        warnings.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check Hero Image
    const heroImg = page.locator("#home img[alt='Ihyaa Youth Gathering']");
    await expect(heroImg).toBeVisible();
    const heroSizes = await heroImg.getAttribute("sizes");
    expect(heroSizes).toBe("100vw");

    // Check About Image
    const aboutImg = page.locator("#about img[src*='gathering']");
    await expect(aboutImg).toBeVisible();
    const aboutSizes = await aboutImg.getAttribute("sizes");
    expect(aboutSizes).toContain("520px");
    expect(aboutSizes).toContain("(max-width: 640px) 100vw");

    // Ensure no Next.js Image sizes mismatch warning occurred
    const sizesWarnings = warnings.filter(
      (w) =>
        w.includes("Image with src") &&
        w.includes("has either width or height modified, but not the other")
    );
    expect(sizesWarnings).toHaveLength(0);
  });
});
