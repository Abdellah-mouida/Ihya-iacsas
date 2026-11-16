import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { extractClientIpFromHeaders } from "@/lib/request-ip";
import { requestPasswordResetService } from "@/lib/services/auth";

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, forgotPasswordSchema);
    const result = await requestPasswordResetService({
      email: body.email,
      locale: body.locale,
      clientIp: extractClientIpFromHeaders(request.headers),
    });

    if (!result.success) {
      throw new ApiError(
        result.status ?? 400,
        result.status === 429 ? "RATE_LIMITED" : "VALIDATION_ERROR",
        result.error ?? "Failed to request password reset",
      );
    }

    return jsonOk({ requested: true });
  });
}
