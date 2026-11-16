import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { createRoom } from "@/lib/chat/rooms";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
    }
    const room = await createRoom(actor.id, body as never);
    return jsonOk({ room }, { status: 201 });
  });
}
