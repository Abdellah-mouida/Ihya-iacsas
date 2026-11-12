import sharp from "sharp";

export type ImageDimensions = {
  imageWidth: number;
  imageHeight: number;
};

/** Reads orientation-aware dimensions for layout reservation without creating a preview image. */
export async function readImageDimensions(source: Buffer): Promise<ImageDimensions> {
  const metadata = await sharp(source, { failOn: "error", limitInputPixels: 80_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Image dimensions are unavailable");
  const swapped = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  return {
    imageWidth: swapped ? metadata.height : metadata.width,
    imageHeight: swapped ? metadata.width : metadata.height,
  };
}
