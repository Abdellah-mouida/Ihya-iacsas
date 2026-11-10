import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const PUBLIC_BRANCHES_CACHE_TAG = "public-home-branches";

/** Only active, public branch data is shared-cached; there is no session input. */
export const getPublicBranches = unstable_cache(
  async () =>
    prisma.branch.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
      select: {
        id: true,
        kind: true,
        geoId: true,
        nameAr: true,
        nameEn: true,
        regionId: true,
        provinceId: true,
        latitude: true,
        longitude: true,
      },
    }),
  ["public-home-branches-v1"],
  { revalidate: 3600, tags: [PUBLIC_BRANCHES_CACHE_TAG] },
);
