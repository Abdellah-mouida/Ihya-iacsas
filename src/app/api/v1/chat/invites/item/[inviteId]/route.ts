import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { revokeInvite } from "@/lib/chat/rooms";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const { inviteId } = await context.params;
    await revokeInvite(actor.id, inviteId);
    return jsonOk({ ok: true });
  });
}
