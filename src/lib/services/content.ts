import { getPublicBranches } from "@/lib/branches/public-data";
import { resolveImageUrl } from "@/lib/content";
import { prisma } from "@/lib/prisma";

export async function listPublicGalleryPhotos(skip = 0, take = 12) {
  const offset = Number.isFinite(skip) ? Math.max(0, Math.trunc(skip)) : 0;
  const limit = Number.isFinite(take) ? Math.min(48, Math.max(1, Math.trunc(take))) : 12;

  const [photos, total] = await Promise.all([
    prisma.galleryPhoto.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        imageUrl: true,
        imageWidth: true,
        imageHeight: true,
        captionAr: true,
        captionEn: true,
        createdAt: true,
      },
    }),
    prisma.galleryPhoto.count(),
  ]);

  return {
    photos: photos.map((photo) => ({
      id: photo.id,
      imageUrl: resolveImageUrl(photo.imageUrl) ?? photo.imageUrl,
      imageWidth: photo.imageWidth,
      imageHeight: photo.imageHeight,
      captionAr: photo.captionAr,
      captionEn: photo.captionEn,
      createdAt: photo.createdAt.toISOString(),
    })),
    total,
    hasMore: offset + photos.length < total,
  };
}

export async function listCarouselPostsService(onlyActive = true) {
  const posts = await prisma.carouselPost.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: { order: "asc" },
    select: {
      id: true,
      imageUrl: true,
      imageWidth: true,
      imageHeight: true,
      order: true,
      active: true,
    },
  });

  return posts.map((post) => ({
    ...post,
    imageUrl: resolveImageUrl(post.imageUrl) ?? post.imageUrl,
  }));
}

export async function listPublicBranchesService() {
  return getPublicBranches();
}
