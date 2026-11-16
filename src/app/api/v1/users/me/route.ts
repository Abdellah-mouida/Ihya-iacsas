import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  getSelfUserProfile,
  updateUserProfileFields,
} from "@/lib/services/users";
import { deleteUserAccount } from "@/lib/user-deletion";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100),
  city: z.string().min(1).max(100),
  age: z.number().int().min(10).max(120),
  bio: z.string().max(280).nullable().optional(),
  studyLevel: z.string().max(100).nullable().optional(),
  institution: z.string().max(120).nullable().optional(),
  interests: z.array(z.string().max(30)).max(8).optional(),
  skills: z.array(z.string().max(30)).max(8).optional(),
  languages: z.array(z.string().max(30)).max(6).optional(),
  volunteerAreas: z.array(z.string().max(30)).max(6).optional(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const user = await getSelfUserProfile(actor.id);
    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }
    return jsonOk({ user });
  });
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, updateProfileSchema);

    const result = await updateUserProfileFields({
      userId: actor.id,
      name: body.name,
      city: body.city,
      age: body.age,
      bio: body.bio,
      studyLevel: body.studyLevel,
      institution: body.institution,
      interests: body.interests,
      skills: body.skills,
      languages: body.languages,
      volunteerAreas: body.volunteerAreas,
      locale: body.locale,
    });

    if (!result.success) {
      throw new ApiError(result.status, "VALIDATION_ERROR", result.error);
    }

    const user = await getSelfUserProfile(actor.id);
    return jsonOk({ user });
  });
}

export async function DELETE(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    await deleteUserAccount({
      targetUserId: actor.id,
      actorId: actor.id,
      action: "ACCOUNT_DELETE",
      reason: "User deleted their own account via /api/v1/users/me",
    });
    return jsonOk({ deleted: true });
  });
}
