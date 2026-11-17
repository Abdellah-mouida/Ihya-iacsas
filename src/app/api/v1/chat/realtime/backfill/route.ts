import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { getChatBackfill } from "@/lib/services/chat";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const url = new URL(request.url);
    const result = await getChatBackfill({
      userId: actor.id,
      conversationId: url.searchParams.get("conversationId")?.trim() || null,
      afterMessageId: url.searchParams.get("afterMessageId")?.trim() || null,
      sinceRaw: url.searchParams.get("since")?.trim() || null,
    });
    if (!result.ok) {
      throw new ApiError(result.status, "NOT_FOUND", result.error);
    }
    return jsonOk({ serverTime: result.serverTime, items: result.items });
  });
}
