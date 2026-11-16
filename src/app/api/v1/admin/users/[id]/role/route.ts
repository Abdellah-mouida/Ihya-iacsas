import { Role } from "@prisma/client";
import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { updateUserRoleForActor } from "@/lib/services/users";

const updateRoleSchema = z.object({
  role: z.nativeEnum(Role),
  reason: z.string().max(300).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      permission: "users:manage_roles",
    });
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateRoleSchema);

    try {
      const user = await updateUserRoleForActor(actor, {
        userId: id,
        newRole: body.role,
        reason: body.reason,
      });
      return jsonOk({ user });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      if (msg === "User not found.") {
        throw new ApiError(404, "NOT_FOUND", msg);
      }
      throw new ApiError(400, "ROLE_UPDATE_REJECTED", msg);
    }
  });
}
