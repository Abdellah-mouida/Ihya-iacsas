import { v2 as cloudinary } from "cloudinary";
import { configureCloudinary, extractCloudinaryPublicId } from "../src/lib/cloudinary";
import { prisma } from "../src/lib/prisma";

async function runReadOnlyAudit() {
  configureCloudinary();

  console.log("=== Read-Only Cloudinary Asset Audit ===");
  const cloudName = cloudinary.config().cloud_name;
  console.log("Target Cloudinary Account:", cloudName || "Not configured");

  if (!cloudName) {
    console.warn("Cloudinary is not configured in environment. Skipping asset fetch.");
    await prisma.$disconnect();
    return;
  }

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

  console.log(`Database references: ${activePublicIds.size} unique Cloudinary public ID(s).`);
  for (const pid of activePublicIds) {
    console.log(`  - [DB ACTIVE] ${pid}`);
  }

  // 2. Fetch resources from Cloudinary for application folders (READ ONLY)
  const folders = ["ihyaa-events", "ihyaa-gallery", "ihyaa-carousel", "ihyaa-uploads"];
  const orphanedAssets: { publicId: string; folder: string; createdAt: string; url: string }[] = [];
  const matchedAssets: string[] = [];

  for (const folder of folders) {
    try {
      const res = await cloudinary.api.resources({
        type: "upload",
        prefix: folder,
        max_results: 100,
      });

      const count = res.resources?.length || 0;
      console.log(`\nFolder "${folder}": ${count} remote asset(s) found.`);

      for (const resource of res.resources || []) {
        const pubId = resource.public_id;
        if (!activePublicIds.has(pubId)) {
          orphanedAssets.push({
            publicId: pubId,
            folder,
            createdAt: resource.created_at,
            url: resource.secure_url,
          });
          console.log(`  - [ORPHAN] ${pubId} (Created: ${resource.created_at})`);
        } else {
          matchedAssets.push(pubId);
          console.log(`  - [IN USE] ${pubId}`);
        }
      }
    } catch (err) {
      console.warn(`Could not list resources for prefix "${folder}":`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n==========================================");
  console.log("AUDIT SUMMARY (READ ONLY - NO ASSETS DELETED):");
  console.log(`Total Database References: ${activePublicIds.size}`);
  console.log(`Total Remote Assets In Use: ${matchedAssets.length}`);
  console.log(`Total Orphaned Remote Assets: ${orphanedAssets.length}`);
  console.log("==========================================");

  if (orphanedAssets.length > 0) {
    console.log("\nOrphaned Assets Listing:");
    orphanedAssets.forEach((a, i) => {
      console.log(`${i + 1}. Public ID: ${a.publicId} | Folder: ${a.folder} | Created: ${a.createdAt}`);
    });
  } else {
    console.log("No orphaned assets detected in surveyed Cloudinary folders.");
  }

  await prisma.$disconnect();
}

runReadOnlyAudit().catch((err) => {
  console.error("Audit error:", err);
  process.exit(1);
});
