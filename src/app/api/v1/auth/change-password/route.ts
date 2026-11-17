import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { changePasswordForUser } from "@/lib/services/auth";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
  confirmNewPassword: z.string().min(8).max(200).optional(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, changePasswordSchema);

    const result = await changePasswordForUser({
      userId: actor.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmNewPassword,
      locale: body.locale,
    });

    if (!result.success) {
      throw new ApiError(
        result.status ?? 400,
        result.status === 429 ? "RATE_LIMITED" : "PASSWORD_CHANGE_FAILED",
        result.error ?? "Failed to change password",
      );
    }

    return jsonOk({
      passwordChanged: true,
      sessionsRevoked: true,
    });
  });
}
