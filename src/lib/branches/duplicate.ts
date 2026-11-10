import "server-only";
import { prisma } from "@/lib/prisma";

/** Warns when a saved geo record is already represented by another branch. */
export async function warnForDuplicateBranchGeoId(geoId: string | null, excludeId?: string) {
  if (!geoId) return;

  const duplicate = await prisma.branch.findFirst({
    where: { geoId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, nameAr: true, nameEn: true },
  });
  if (duplicate) {
    console.warn("[branches] Duplicate geography id", {
      geoId,
      existingBranchId: duplicate.id,
      existingBranchName: duplicate.nameEn ?? duplicate.nameAr,
      excludedBranchId: excludeId,
    });
  }
}
