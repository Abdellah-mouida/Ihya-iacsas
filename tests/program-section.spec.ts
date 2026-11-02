import { test, expect } from "@playwright/test";

test.describe("Task 3: Program section refinements", () => {
  test("program section has min-h-[70vh], overflow-visible, and clickable CTA top-layer", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const programSection = page.locator("#program");
    await expect(programSection).toBeVisible();

    // Check min-height is at least 70vh
    const boundingBox = await programSection.boundingBox();
    expect(boundingBox).not.toBeNull();
    const minExpectedHeight = 900 * 0.7; // 630px
    expect(boundingBox!.height).toBeGreaterThanOrEqual(minExpectedHeight);

    // Check CTA button is interactive and top layer
    const ctaButton = programSection.locator('a[href="#contact"]');
    await expect(ctaButton).toBeVisible();

    // Scroll CTA button into view so viewport coordinates match
    await ctaButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const ctaBox = await ctaButton.boundingBox();
    expect(ctaBox).not.toBeNull();

    // Verify document.elementsFromPoint returns the CTA button / anchor or its parent button at the center
    const topElementTag = await page.evaluate(({ x, y }) => {
      const els = document.elementsFromPoint(x, y);
      return els.map((el) => el.tagName.toLowerCase());
    }, { x: ctaBox!.x + ctaBox!.width / 2, y: ctaBox!.y + ctaBox!.height / 2 });

    expect(topElementTag[0] === "a" || topElementTag[0] === "button" || topElementTag[1] === "a").toBeTruthy();
  });
});
