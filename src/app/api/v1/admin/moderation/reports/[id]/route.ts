import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { resolveChatReport } from "@/lib/chat/moderation";

const resolveSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().trim().max(500).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(
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
      throw new ApiError(404, "NOT_FOUND", "Report not found");
    }
    const body = await parseJsonBody(request, resolveSchema);
    const report = await resolveChatReport({
      reportId: id,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
      },
      status: body.status,
      resolutionNote: body.resolutionNote,
    });
    return jsonOk({ report });
  });
}
