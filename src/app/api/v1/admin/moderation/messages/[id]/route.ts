import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { moderateDeletePublicMessage } from "@/lib/chat/moderation";

const deleteBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "chat:moderate" });
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
    }
    const { id } = await context.params;
    if (!id || id.length > 64) {
      throw new ApiError(404, "NOT_FOUND", "Message not found");
    }

    let reason: string | undefined;
    const rawBody = await request.json().catch(() => null);
    if (rawBody && typeof rawBody === "object") {
      const parsed = deleteBodySchema.safeParse(rawBody);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid reason");
      }
      reason = parsed.data.reason;
    }

    const deleted = await moderateDeletePublicMessage({
      messageId: id,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
      reason,
    });
    return jsonOk({ deleted });
  });
}
