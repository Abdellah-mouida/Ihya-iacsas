import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { removeRoomMember } from "@/lib/chat/rooms";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const { id, memberId } = await context.params;
    await removeRoomMember(actor.id, id, memberId);
    return jsonOk({ ok: true });
  });
}
