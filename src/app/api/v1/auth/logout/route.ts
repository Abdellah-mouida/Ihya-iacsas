import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { getOptionalApiActor } from "@/lib/api/v1/guard";
import {
  revokeApiSessionByRefreshToken,
  revokeApiSessionForUser,
} from "@/lib/api/v1/sessions";

const logoutSchema = z.object({
  refreshToken: z.string().min(20).max(512).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await getOptionalApiActor(request);

    let refreshToken: string | undefined;
    const rawText = await request.text();
    if (rawText.trim()) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
      }
      const parsed = logoutSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid logout payload");
      }
      refreshToken = parsed.data.refreshToken;
    }

    if (!actor && !refreshToken) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "Provide an access token or refreshToken to log out",
      );
    }

    if (actor) {
      await revokeApiSessionForUser(actor.id, actor.sessionId, "USER_LOGOUT");
    }
    if (refreshToken) {
      await revokeApiSessionByRefreshToken(refreshToken, actor?.id);
    }

    return jsonOk({ loggedOut: true });
  });
}
