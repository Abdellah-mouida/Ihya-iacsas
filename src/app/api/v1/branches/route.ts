import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { listPublicBranchesService } from "@/lib/services/content";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const branches = await listPublicBranchesService();
    return jsonOk(
      { branches },
      { cacheControl: "public, s-maxage=120, stale-while-revalidate=600" },
    );
  });
}
