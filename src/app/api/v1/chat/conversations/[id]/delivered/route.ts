import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { markConversationDelivered } from "@/lib/chat/messages";

const deliveredSchema = z.object({
  at: z.string().datetime().optional(),
});

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

    let parsedAt: string | undefined;
    const text = await request.text();
    if (text.trim()) {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Invalid JSON request body");
      }
      const parsed = deliveredSchema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Validation failed", {
          details: parsed.error.flatten().fieldErrors,
        });
      }
      parsedAt = parsed.data.at;
    }

    const lastDeliveredAt = await markConversationDelivered({
      userId: actor.id,
      conversationId: id,
      at: parsedAt,
    });
    return jsonOk({
      ok: true,
      lastDeliveredAt: lastDeliveredAt.toISOString(),
    });
  });
}
