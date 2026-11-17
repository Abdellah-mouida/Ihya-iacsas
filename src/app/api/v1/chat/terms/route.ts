import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { acceptChatTerms } from "@/lib/chat/messages";

const termsSchema = z.object({
  accepted: z.literal(true),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
    });
    await parseJsonBody(request, termsSchema);
    const acceptedAt = await acceptChatTerms(actor.id);
    return jsonOk({
      ok: true,
      chatTermsAcceptedAt: acceptedAt.toISOString(),
    });
  });
}
