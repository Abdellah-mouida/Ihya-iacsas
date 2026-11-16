import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { inspectLinkInvite } from "@/lib/chat/rooms";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
    });
    const { token } = await context.params;
    const invite = await inspectLinkInvite(actor.id, token);
    return jsonOk({ invite });
  });
}
