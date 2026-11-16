import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { deleteOrAnonymizeUserForActor } from "@/lib/services/users";

const deleteSchema = z.object({
  action: z.enum(["delete", "anonymize"]).default("delete"),
  reason: z.string().max(300).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "users:delete" });
    const { id } = await context.params;

    let action: "delete" | "anonymize" = "delete";
    let reason: string | undefined;
    const rawText = await request.text();
    if (rawText.trim()) {
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(rawText);
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
      }
      const parsed = deleteSchema.safeParse(rawJson);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      action = parsed.data.action;
      reason = parsed.data.reason;
    }

    try {
      await deleteOrAnonymizeUserForActor(actor, {
        userId: id,
        action,
        reason,
      });
      return jsonOk({ success: true, id, action });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove user";
      if (msg === "User not found.") {
        throw new ApiError(404, "NOT_FOUND", msg);
      }
      throw new ApiError(400, "USER_DELETE_REJECTED", msg);
    }
  });
}
