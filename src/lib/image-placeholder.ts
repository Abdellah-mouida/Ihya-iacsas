import sharp from "sharp";

export type ImagePlaceholder = {
  blurDataUrl: string;
  imageWidth: number;
  imageHeight: number;
};

/** Builds a tiny inline WebP blur while keeping the source dimensions for layout reservation. */
export async function createImagePlaceholder(source: Buffer): Promise<ImagePlaceholder> {
  const image = sharp(source, { failOn: "error", limitInputPixels: 80_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Image dimensions are unavailable");

  let blurDataUrl = "";
  for (const width of [24, 20, 16]) {
    for (const quality of [28, 20, 14]) {
      const thumb = await image.clone().rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 0 }).toBuffer();
      const candidate = `data:image/webp;base64,${thumb.toString("base64")}`;
      if (Buffer.byteLength(candidate, "utf8") <= 1024) {
        blurDataUrl = candidate;
        break;
      }
    }
    if (blurDataUrl) break;
  }
  if (!blurDataUrl) throw new Error("Could not create an image placeholder under 1KB");

  const swapped = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  return {
    blurDataUrl,
    imageWidth: swapped ? metadata.height : metadata.width,
    imageHeight: swapped ? metadata.width : metadata.height,
  };
}
