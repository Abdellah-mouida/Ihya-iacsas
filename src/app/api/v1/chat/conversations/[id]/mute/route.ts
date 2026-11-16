import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { setConversationMuted } from "@/lib/chat/messages";

const muteSchema = z.object({
  muted: z.boolean(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(
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
    const body = await parseJsonBody(request, muteSchema);
    const muted = await setConversationMuted({
      userId: actor.id,
      conversationId: id,
      muted: body.muted,
    });
    return jsonOk({ ok: true, muted });
  });
}
