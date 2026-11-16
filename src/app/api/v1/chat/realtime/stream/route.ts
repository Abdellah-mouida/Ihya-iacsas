import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { createLocalSseStreamResponse } from "@/lib/services/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const result = await createLocalSseStreamResponse({
      request,
      user: actor,
    });
    if (!result.ok) {
      throw new ApiError(result.status, result.code, result.error);
    }
    return result.response;
  });
}
