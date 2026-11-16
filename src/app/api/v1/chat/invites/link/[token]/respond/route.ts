import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { respondToLinkInvite } from "@/lib/chat/rooms";

const respondSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
    });
    const { token } = await context.params;
    const body = await parseJsonBody(request, respondSchema);
    const result = await respondToLinkInvite(actor.id, token, body.decision);
    return jsonOk(result);
  });
}
