import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { deleteContactMessageForActor } from "@/lib/services/contacts";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "contacts:manage" });
    const { id } = await context.params;
    await deleteContactMessageForActor(actor, id);
    return jsonOk({ deleted: true, id });
  });
}
