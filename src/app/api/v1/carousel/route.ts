import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { listCarouselPostsService } from "@/lib/services/content";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const posts = await listCarouselPostsService(true);
    return jsonOk(
      { posts },
      { cacheControl: "public, s-maxage=60, stale-while-revalidate=300" },
    );
  });
}
