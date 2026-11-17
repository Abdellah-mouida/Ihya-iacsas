import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { setGlobalChatEnabled } from "@/lib/chat/moderation";

const settingsSchema = z.object({
  enabled: z.boolean(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      permission: "settings:manage",
    });
    if (actor.role !== "ADMIN" && actor.role !== "MODERATOR") {
      throw new ApiError(403, "FORBIDDEN", "Insufficient permissions");
    }
    const body = await parseJsonBody(request, settingsSchema);
    const result = await setGlobalChatEnabled({
      enabled: body.enabled,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
    });
    return jsonOk(result);
  });
}
