import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { getFriendsDashboardData } from "@/lib/chat/friends";
import { executeFriendAction, friendActionSchema } from "@/lib/services/chat";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
    });
    const data = await getFriendsDashboardData(actor.id);
    return jsonOk(data);
  });
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
    });
    const body = await parseJsonBody(request, friendActionSchema);
    const result = await executeFriendAction({
      actorId: actor.id,
      actorName: actor.name,
      action: body.action,
      targetUserId: body.targetUserId,
    });
    return jsonOk(result);
  });
}
