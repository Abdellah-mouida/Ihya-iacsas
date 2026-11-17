import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { setNotificationReadState } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  read: z.boolean(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;
    const body = await parseJsonBody(request, patchSchema);

    const updated = await setNotificationReadState(actor.id, id, body.read);
    if (!updated) {
      throw new ApiError(404, "NOT_FOUND", "Notification not found");
    }
    return jsonOk(updated);
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;

    const deleted = await prisma.notification.deleteMany({
      where: { id, userId: actor.id },
    });
    if (deleted.count === 0) {
      throw new ApiError(404, "NOT_FOUND", "Notification not found");
    }

    return jsonOk({ deleted: true, id });
  });
}
