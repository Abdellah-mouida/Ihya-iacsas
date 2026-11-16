import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { revokeApiSessionForUser } from "@/lib/api/v1/sessions";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;
    await revokeApiSessionForUser(actor.id, id, "USER_REVOKED_SESSION");
    return jsonOk({ revoked: true, sessionId: id });
  });
}
