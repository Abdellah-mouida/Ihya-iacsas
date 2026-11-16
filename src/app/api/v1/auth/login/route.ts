import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import {
  extractDeviceContext,
  loginWithPasswordForApi,
} from "@/lib/api/v1/sessions";
import { getSelfUserProfile } from "@/lib/services/users";

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  deviceName: z.string().max(100).optional(),
  platform: z.string().max(32).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, loginSchema);
    const { tokens, userId } = await loginWithPasswordForApi({
      email: body.email,
      password: body.password,
      device: extractDeviceContext(request, {
        deviceName: body.deviceName,
        platform: body.platform,
      }),
    });
    const user = await getSelfUserProfile(userId);
    return jsonOk({ ...tokens, user });
  });
}
