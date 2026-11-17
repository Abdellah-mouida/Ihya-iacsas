import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { openOrCreateDmConversation } from "@/lib/chat/messages";

const dmSchema = z.object({
  peerId: z.string().trim().min(1).max(64),
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
    const body = await parseJsonBody(request, dmSchema);
    const conversation = await openOrCreateDmConversation(actor.id, body.peerId);
    return jsonOk({ conversation });
  });
}
