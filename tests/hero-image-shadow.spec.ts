import { expect, test } from "@playwright/test";

test.describe("Hero image load-gated shadow", () => {
  test("precedes the image, has no border/outline, and stays opacity 0 until image loads", async ({
    page,
  }) => {
    let releaseImage!: () => void;
    const imageGate = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    let intercepted = false;

    await page.route("**/images/group-portrait-hero*", async (route) => {
      intercepted = true;
      await imageGate;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => intercepted, { timeout: 10_000 }).toBe(true);

    const beforeLoad = await page.evaluate(() => {
      const shadow = document.querySelector<SVGSVGElement>(
        "#home [data-testid='hero-frame-shadow']",
      );
      const photoFrame = document.querySelector<HTMLElement>(
        "#home [data-testid='hero-photo-frame']",
      );
      const img = document.querySelector<HTMLImageElement>(
        "#home img[src*='group-portrait']",
      );
      const shadowPath = shadow?.querySelector("path");
      if (!shadow || !photoFrame || !img || !shadowPath) {
        return null;
      }
      const shadowStyle = getComputedStyle(shadow);
      const frameStyle = getComputedStyle(photoFrame);
      const pathStyle = getComputedStyle(shadowPath);
      const precedesImage =
        Boolean(shadow.compareDocumentPosition(photoFrame) & Node.DOCUMENT_POSITION_FOLLOWING) &&
        Boolean(shadow.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING);

      return {
        precedesImage,
        shadowZ: Number.parseInt(shadowStyle.zIndex || "0", 10),
        frameZ: Number.parseInt(frameStyle.zIndex || "0", 10),
        shadowBorderWidth: shadowStyle.borderTopWidth,
        shadowOutlineWidth: shadowStyle.outlineWidth,
        frameBorderWidth: frameStyle.borderTopWidth,
        frameOutlineWidth: frameStyle.outlineWidth,
        pathStroke: pathStyle.stroke,
        shadowAnimation: shadowStyle.animationName,
        opacityBeforeLoad: Number.parseFloat(shadowStyle.opacity),
        filter: pathStyle.filter,
      };
    });

    expect(beforeLoad).not.toBeNull();
    expect(beforeLoad!.precedesImage).toBe(true);
    expect(beforeLoad!.shadowZ).toBeLessThan(beforeLoad!.frameZ);
    expect(beforeLoad!.shadowBorderWidth).toBe("0px");
    expect(beforeLoad!.shadowOutlineWidth).toBe("0px");
    expect(beforeLoad!.frameBorderWidth).toBe("0px");
    expect(beforeLoad!.frameOutlineWidth).toBe("0px");
    expect(beforeLoad!.pathStroke).toBe("none");
    expect(beforeLoad!.shadowAnimation).toBe("none");
    expect(beforeLoad!.opacityBeforeLoad).toBe(0);
    expect(beforeLoad!.filter).toContain("drop-shadow");

    releaseImage();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const img = document.querySelector<HTMLImageElement>(
              "#home img[src*='group-portrait']",
            );
            const shadow = document.querySelector<SVGSVGElement>(
              "#home [data-testid='hero-frame-shadow']",
            );
            if (!img || !shadow) return { loaded: false, opacity: 0 };
            return {
              loaded: img.complete && img.naturalWidth > 0,
              opacity: Number.parseFloat(getComputedStyle(shadow).opacity),
            };
          }),
        { timeout: 15_000 },
      )
      .toEqual({ loaded: true, opacity: 1 });
  });
});
