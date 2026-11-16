import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { getPublicUserProfileDto } from "@/lib/services/users";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;
    const profile = await getPublicUserProfileDto(actor.id, id);
    if (!profile) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }
    return jsonOk({ user: profile });
  });
}
