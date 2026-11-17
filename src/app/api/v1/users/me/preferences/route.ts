import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { updateUserPreferencesForUser } from "@/lib/services/users";

const preferencesSchema = z.object({
  theme: z.string().min(1).max(64).optional(),
  locale: z.enum(["ar", "en"]).optional(),
  reduceMotion: z.boolean().optional(),
  coverImage: z.string().max(300).nullable().optional(),
  uploadProof: z.string().min(10).max(2048).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, preferencesSchema);

    const result = await updateUserPreferencesForUser({
      userId: actor.id,
      theme: body.theme,
      locale: body.locale,
      reduceMotion: body.reduceMotion,
      coverImage: body.coverImage,
      uploadProof: body.uploadProof,
    });

    if (!result.success) {
      throw new ApiError(result.status, "VALIDATION_ERROR", result.error);
    }

    return jsonOk({ preferences: result.preferences });
  });
}
