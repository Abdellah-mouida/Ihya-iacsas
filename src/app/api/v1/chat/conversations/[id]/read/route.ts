import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { markConversationRead } from "@/lib/chat/messages";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const { id } = await context.params;
    if (!id || id.length > 64) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }
    const lastReadAt = await markConversationRead({
      userId: actor.id,
      conversationId: id,
    });
    return jsonOk({ ok: true, lastReadAt: lastReadAt.toISOString() });
  });
}
