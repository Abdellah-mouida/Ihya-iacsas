import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import {
  extractDeviceContext,
  refreshApiSessionTokens,
} from "@/lib/api/v1/sessions";

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
  deviceName: z.string().max(100).optional(),
  platform: z.string().max(32).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, refreshSchema);
    const tokens = await refreshApiSessionTokens(
      body.refreshToken,
      extractDeviceContext(request, {
        deviceName: body.deviceName,
        platform: body.platform,
      }),
    );
    return jsonOk(tokens);
  });
}
