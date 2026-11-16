import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { updateUserPrivacyForUser } from "@/lib/services/users";

const privacySchema = z.object({
  friendRequestPolicy: z.enum(["EVERYONE", "NOBODY"]).optional(),
  showOnlineStatus: z.boolean().optional(),
  showFriendCount: z.boolean().optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, privacySchema);
    const privacy = await updateUserPrivacyForUser(actor.id, body);
    return jsonOk({ privacy });
  });
}
