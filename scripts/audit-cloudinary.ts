import { v2 as cloudinary } from "cloudinary";
import { configureCloudinary, extractCloudinaryPublicId } from "../src/lib/cloudinary";
import { prisma } from "../src/lib/prisma";

async function runAudit() {
  configureCloudinary();

  console.log("--- Cloudinary Asset Audit ---");
  console.log("Cloud Name:", cloudinary.config().cloud_name);

  // 1. Gather all active image URLs from database
  const events = await prisma.event.findMany({ select: { id: true, titleEn: true, posterUrl: true } });
  const gallery = await prisma.galleryPhoto.findMany({ select: { id: true, imageUrl: true } });
  const carousel = await prisma.carouselPost.findMany({ select: { id: true, imageUrl: true } });

  const activePublicIds = new Set<string>();

  for (const ev of events) {
    const pid = extractCloudinaryPublicId(ev.posterUrl);
    if (pid) activePublicIds.add(pid);
  }
  for (const photo of gallery) {
    const pid = extractCloudinaryPublicId(photo.imageUrl);
    if (pid) activePublicIds.add(pid);
  }
  for (const post of carousel) {
    const pid = extractCloudinaryPublicId(post.imageUrl);
    if (pid) activePublicIds.add(pid);
  }

  console.log(`Found ${activePublicIds.size} referenced Cloudinary asset(s) in database:`);
  for (const pid of activePublicIds) {
    console.log(`  - ${pid}`);
  }

  // 2. Fetch resources from Cloudinary for our app folders
  const folders = ["ihyaa-events", "ihyaa-gallery", "ihyaa-carousel", "ihyaa-uploads"];
  const orphanedAssets: string[] = [];

  for (const folder of folders) {
    try {
      const res = await cloudinary.api.resources({
        type: "upload",
        prefix: folder,
        max_results: 100,
      });

      console.log(`\nFolder "${folder}": ${res.resources?.length || 0} remote asset(s)`);

      for (const resource of res.resources || []) {
        const pubId = resource.public_id;
        if (!activePublicIds.has(pubId)) {
          orphanedAssets.push(pubId);
          console.log(`  [ORPHAN] ${pubId} (Created: ${resource.created_at})`);
        } else {
          console.log(`  [ACTIVE] ${pubId}`);
        }
      }
    } catch (err) {
      console.warn(`Could not list resources for prefix "${folder}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nAudit completed: ${orphanedAssets.length} orphaned asset(s) detected.`);

  // 3. Clean up orphans
  if (orphanedAssets.length > 0) {
    console.log("Cleaning up orphaned assets from Cloudinary...");
    for (const orphan of orphanedAssets) {
      try {
        const delRes = await cloudinary.uploader.destroy(orphan, { invalidate: true });
        console.log(`  Deleted ${orphan}:`, delRes);
      } catch (delErr) {
        console.error(`  Failed to delete ${orphan}:`, delErr);
      }
    }
  }

  await prisma.$disconnect();
}

runAudit().catch(console.error);
