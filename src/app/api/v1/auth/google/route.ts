import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import {
  extractDeviceContext,
  loginWithGoogleForApi,
} from "@/lib/api/v1/sessions";
import { getSelfUserProfile } from "@/lib/services/users";

const googleAuthSchema = z.object({
  idToken: z.string().min(20).max(8192),
  deviceName: z.string().max(100).optional(),
  platform: z.string().max(32).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, googleAuthSchema);
    const { tokens, userId } = await loginWithGoogleForApi({
      idToken: body.idToken,
      device: extractDeviceContext(request, {
        deviceName: body.deviceName,
        platform: body.platform,
      }),
    });
    const user = await getSelfUserProfile(userId);
    return jsonOk({ ...tokens, user });
  });
}
