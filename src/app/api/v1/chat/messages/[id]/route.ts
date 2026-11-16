import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  deleteMessage,
  editMessage,
  getConversationMessageById,
  MAX_MESSAGE_LENGTH,
} from "@/lib/chat/messages";

const editSchema = z.object({
  body: z.string().max(MAX_MESSAGE_LENGTH + 200),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
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
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }
    const message = await getConversationMessageById({
      userId: actor.id,
      messageId: id,
    });
    return jsonOk({ message });
  });
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
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }
    const body = await parseJsonBody(request, editSchema);
    const message = await editMessage({
      userId: actor.id,
      messageId: id,
      body: body.body,
    });
    return jsonOk({ message });
  });
}

export async function DELETE(
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
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }
    const message = await deleteMessage({
      userId: actor.id,
      messageId: id,
    });
    return jsonOk({ message });
  });
}
