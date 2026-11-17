import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  getOnlineUsersForChat,
  updatePresenceForChat,
} from "@/lib/services/chat";

const presenceSchema = z.object({
  online: z.boolean().default(true),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const result = await getOnlineUsersForChat();
    return jsonOk(result);
  });
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const body = await parseJsonBody(request, presenceSchema);
    const result = await updatePresenceForChat({
      actorId: actor.id,
      showOnlineStatus: actor.showOnlineStatus,
      online: body.online,
    });
    return jsonOk(result);
  });
}
