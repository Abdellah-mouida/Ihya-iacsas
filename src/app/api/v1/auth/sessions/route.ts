import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { listApiSessionsForUser } from "@/lib/api/v1/sessions";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const sessions = await listApiSessionsForUser(actor.id, actor.sessionId);
    return jsonOk({ sessions });
  });
}
