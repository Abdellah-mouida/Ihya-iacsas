import { expect, test } from "@playwright/test";
import sharp from "sharp";

import { createImagePlaceholder } from "../src/lib/image-placeholder";

test("creates a tiny WebP placeholder and preserves oriented dimensions", async () => {
  const source = await sharp({
    create: { width: 640, height: 360, channels: 3, background: { r: 30, g: 100, b: 70 } },
  }).jpeg().toBuffer();

  const result = await createImagePlaceholder(source);
  const encodedLength = Buffer.byteLength(result.blurDataUrl, "utf8");

  expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
  expect(encodedLength).toBeLessThanOrEqual(1024);
  expect(result.imageWidth).toBe(640);
  expect(result.imageHeight).toBe(360);
});
