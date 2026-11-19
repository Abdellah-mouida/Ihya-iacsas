import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  DEFAULT_PAGE_SIZE,
  getConversationMessages,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_SIZE,
  sendMessage,
} from "@/lib/chat/messages";

const sendSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  body: z.string().max(MAX_MESSAGE_LENGTH + 200),
  clientId: z.string().trim().min(1).max(100).optional(),
  replyToId: z.string().trim().min(1).max(64).optional().nullable(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversationId")?.trim() ?? "";
    if (!conversationId || conversationId.length > 64) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }

    const cursor = searchParams.get("cursor")?.trim() || null;
    const wire = searchParams.get("wire") === "1";
    const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(rawLimit)))
      : DEFAULT_PAGE_SIZE;

    const result = await getConversationMessages({
      userId: actor.id,
      conversationId,
      cursor,
      limit,
      wire,
    });
    return jsonOk(result);
  });
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const body = await parseJsonBody(request, sendSchema);
    const result = await sendMessage({
      userId: actor.id,
      conversationId: body.conversationId,
      body: body.body,
      clientId: body.clientId,
      replyToId: body.replyToId,
      publicTimeoutUntil: actor.chatPublicTimeoutUntil,
    });
    return jsonOk(
      { message: result.message },
      { status: result.deduplicated ? 200 : 201 },
    );
  });
}
