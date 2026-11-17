import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { updateUserAvatarForUser } from "@/lib/services/users";

const avatarSchema = z.object({
  imageUrl: z.string().max(300).nullable().optional(),
  uploadProof: z.string().min(10).max(2048).optional(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, avatarSchema);
    const result = await updateUserAvatarForUser({
      userId: actor.id,
      imageUrl: body.imageUrl,
      uploadProof: body.uploadProof,
      locale: body.locale,
    });

    if (!result.success) {
      throw new ApiError(
        result.status ?? 400,
        result.status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
        result.error ?? "Failed to update avatar",
      );
    }

    return jsonOk({ image: result.image });
  });
}
