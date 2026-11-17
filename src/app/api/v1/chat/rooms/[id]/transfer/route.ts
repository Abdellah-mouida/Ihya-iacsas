import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { transferRoomOwnership } from "@/lib/chat/rooms";

const transferSchema = z.object({
  newOwnerId: z.string().trim().min(1).max(64),
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
    const body = await parseJsonBody(request, transferSchema);
    await transferRoomOwnership(actor.id, id, body.newOwnerId);
    return jsonOk({ ok: true });
  });
}
