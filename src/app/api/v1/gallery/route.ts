import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parsePagination } from "@/lib/api/v1/errors";
import { listPublicGalleryPhotos } from "@/lib/services/content";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url, {
      defaultLimit: 12,
      maxLimit: 48,
    });
    const result = await listPublicGalleryPhotos(skip, limit);

    return jsonOk(
      {
        photos: result.photos,
        pagination: {
          page,
          limit,
          total: result.total,
          hasMore: result.hasMore,
        },
      },
      { cacheControl: "public, s-maxage=60, stale-while-revalidate=300" },
    );
  });
}
