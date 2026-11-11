import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;

async function createPlaceholder(buffer) {
  const image = sharp(buffer, { failOn: "error", limitInputPixels: 80_000_000 });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Missing image dimensions");
  for (const width of [24, 20, 16]) {
    for (const quality of [28, 20, 14]) {
      const thumb = await image.clone().rotate().resize({ width, withoutEnlargement: true }).webp({ quality, effort: 0 }).toBuffer();
      const blurDataUrl = `data:image/webp;base64,${thumb.toString("base64")}`;
      if (Buffer.byteLength(blurDataUrl, "utf8") <= 1024) {
        const swapped = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
        return {
          blurDataUrl,
          imageWidth: swapped ? metadata.height : metadata.width,
          imageHeight: swapped ? metadata.width : metadata.height,
        };
      }
    }
  }
  throw new Error("Placeholder exceeded 1KB");
}

async function fetchCloudinaryImage(imageUrl) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") {
    throw new Error(`Refusing non-Cloudinary image URL host: ${url.hostname}`);
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Cloudinary fetch failed with ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_REMOTE_BYTES) throw new Error("Source image exceeds 20MB backfill limit");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_BYTES) throw new Error("Source image exceeds 20MB backfill limit");
  return buffer;
}

async function backfillModel({ name, model, urlField, blurField, widthField, heightField }) {
  const rows = await model.findMany({
    where: {
      [urlField]: { startsWith: "https://res.cloudinary.com/" },
      OR: [{ [blurField]: null }, { [widthField]: null }, { [heightField]: null }],
    },
    select: { id: true, [urlField]: true, [blurField]: true, [widthField]: true, [heightField]: true },
  });
  let updated = 0;
  const failures = [];
  for (const row of rows) {
    try {
      const placeholder = await createPlaceholder(await fetchCloudinaryImage(row[urlField]));
      await model.update({
        where: { id: row.id },
        data: {
          [blurField]: row[blurField] ?? placeholder.blurDataUrl,
          [widthField]: row[widthField] ?? placeholder.imageWidth,
          [heightField]: row[heightField] ?? placeholder.imageHeight,
        },
      });
      updated += 1;
    } catch (error) {
      failures.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.info(`[backfill:blur] ${name}: ${updated}/${rows.length} rows updated.`);
  return failures;
}

async function main() {
  const failures = [];
  failures.push(...await backfillModel({ name: "GalleryPhoto", model: prisma.galleryPhoto, urlField: "imageUrl", blurField: "blurDataUrl", widthField: "imageWidth", heightField: "imageHeight" }));
  failures.push(...await backfillModel({ name: "CarouselPost", model: prisma.carouselPost, urlField: "imageUrl", blurField: "blurDataUrl", widthField: "imageWidth", heightField: "imageHeight" }));
  failures.push(...await backfillModel({ name: "Event", model: prisma.event, urlField: "posterUrl", blurField: "posterBlurDataUrl", widthField: "posterWidth", heightField: "posterHeight" }));

  const coverRows = await prisma.user.findMany({
    where: {
      coverImage: { startsWith: "https://res.cloudinary.com/" },
      OR: [{ coverBlurDataUrl: null }, { coverWidth: null }, { coverHeight: null }],
    },
    select: { id: true, coverImage: true, coverBlurDataUrl: true, coverWidth: true, coverHeight: true },
  });
  let coversUpdated = 0;
  for (const user of coverRows) {
    try {
      const placeholder = await createPlaceholder(await fetchCloudinaryImage(user.coverImage));
      await prisma.user.update({
        where: { id: user.id },
        data: {
          coverBlurDataUrl: user.coverBlurDataUrl ?? placeholder.blurDataUrl,
          coverWidth: user.coverWidth ?? placeholder.imageWidth,
          coverHeight: user.coverHeight ?? placeholder.imageHeight,
        },
      });
      coversUpdated += 1;
    } catch (error) {
      failures.push({ id: user.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.info(`[backfill:blur] User covers: ${coversUpdated}/${coverRows.length} rows updated.`);

  if (failures.length) {
    console.error(`[backfill:blur] ${failures.length} row(s) could not be processed:`, failures);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[backfill:blur] Failed:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
