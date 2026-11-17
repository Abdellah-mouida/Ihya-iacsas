import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  getAuthorizedChannelsForUser,
  getRealtimeTransport,
} from "@/lib/chat/realtime";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const authz = await getAuthorizedChannelsForUser(actor.id);
    const transport = getRealtimeTransport();
    const token = await transport.issueClientToken({
      userId: actor.id,
      channels: authz.channels,
      showOnlineStatus: authz.showOnlineStatus,
      ttlMs: TOKEN_TTL_MS,
    });
    return jsonOk(token);
  });
}
