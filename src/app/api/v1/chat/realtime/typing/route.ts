import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { publishTypingEvent } from "@/lib/services/chat";

const typingSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  isTyping: z.boolean(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const body = await parseJsonBody(request, typingSchema);
    const result = await publishTypingEvent({
      actorId: actor.id,
      showOnlineStatus: actor.showOnlineStatus,
      conversationId: body.conversationId,
      isTyping: body.isTyping,
    });
    if (!result.ok) {
      throw new ApiError(result.status, "NOT_FOUND", result.error);
    }
    return jsonOk(result);
  });
}
