import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const MAX_REMOTE_BYTES = 20 * 1024 * 1024;

async function readDimensions(buffer) {
  const metadata = await sharp(buffer, { failOn: "error", limitInputPixels: 80_000_000 }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Missing image dimensions");
  const swapped = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  return { width: swapped ? metadata.height : metadata.width, height: swapped ? metadata.width : metadata.height };
}

async function fetchCloudinaryImage(imageUrl) {
  const url = new URL(imageUrl);
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") throw new Error(`Refusing non-Cloudinary image URL host: ${url.hostname}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Cloudinary fetch failed with ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_REMOTE_BYTES) throw new Error("Source image exceeds 20MB backfill limit");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_BYTES) throw new Error("Source image exceeds 20MB backfill limit");
  return buffer;
}

async function backfillModel({ name, model, urlField, widthField, heightField }) {
  const rows = await model.findMany({
    where: { [urlField]: { startsWith: "https://res.cloudinary.com/" }, OR: [{ [widthField]: null }, { [heightField]: null }] },
    select: { id: true, [urlField]: true, [widthField]: true, [heightField]: true },
  });
  const failures = [];
  let updated = 0;
  for (const row of rows) {
    try {
      const dimensions = await readDimensions(await fetchCloudinaryImage(row[urlField]));
      await model.update({ where: { id: row.id }, data: { [widthField]: row[widthField] ?? dimensions.width, [heightField]: row[heightField] ?? dimensions.height } });
      updated += 1;
    } catch (error) {
      failures.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.info(`[backfill:image-size] ${name}: ${updated}/${rows.length} rows updated.`);
  return failures;
}

async function main() {
  const failures = [];
  failures.push(...await backfillModel({ name: "GalleryPhoto", model: prisma.galleryPhoto, urlField: "imageUrl", widthField: "imageWidth", heightField: "imageHeight" }));
  failures.push(...await backfillModel({ name: "CarouselPost", model: prisma.carouselPost, urlField: "imageUrl", widthField: "imageWidth", heightField: "imageHeight" }));
  failures.push(...await backfillModel({ name: "Event", model: prisma.event, urlField: "posterUrl", widthField: "posterWidth", heightField: "posterHeight" }));
  const covers = await backfillModel({ name: "User covers", model: prisma.user, urlField: "coverImage", widthField: "coverWidth", heightField: "coverHeight" });
  failures.push(...covers);
  if (failures.length) {
    console.error(`[backfill:image-size] ${failures.length} row(s) could not be processed:`, failures);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("[backfill:image-size] Failed:", error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
