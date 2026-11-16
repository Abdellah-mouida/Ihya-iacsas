import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  deleteRoom,
  getRoomDetails,
  updateRoomSettings,
} from "@/lib/chat/rooms";

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
    const room = await getRoomDetails(actor.id, id);
    return jsonOk({ room });
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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
    const room = await updateRoomSettings(actor.id, id, body as never);
    return jsonOk({ room });
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
    await deleteRoom(actor.id, id);
    return jsonOk({ ok: true });
  });
}
