import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { timeoutUserFromPublicChat } from "@/lib/chat/moderation";

const timeoutSchema = z.object({
  hours: z.number().finite().min(0).max(720),
  reason: z.string().trim().max(500).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(
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
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }
    const body = await parseJsonBody(request, timeoutSchema);
    const result = await timeoutUserFromPublicChat({
      targetUserId: id,
      hours: body.hours,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
      reason: body.reason,
    });
    return jsonOk(result);
  });
}
