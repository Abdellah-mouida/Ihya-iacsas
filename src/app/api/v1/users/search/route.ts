import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { searchUsersByNamePrefix } from "@/lib/chat/friends";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { requireOnboarding: true });
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    if (!q.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Query parameter 'q' is required");
    }

    const users = await searchUsersByNamePrefix(actor.id, q);
    return jsonOk({ users });
  });
}
