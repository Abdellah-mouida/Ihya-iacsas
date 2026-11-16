import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { verifyAccountEmailWithOtp } from "@/lib/services/auth";

const verifyEmailSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().length(6),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, verifyEmailSchema);
    const result = await verifyAccountEmailWithOtp({
      email: body.email,
      code: body.code,
      locale: body.locale,
    });

    if (!result.success) {
      const code =
        result.status === 429
          ? "RATE_LIMITED"
          : result.status === 404
            ? "NOT_FOUND"
            : "VERIFICATION_FAILED";
      throw new ApiError(result.status ?? 400, code, result.error ?? "Verification failed");
    }

    return jsonOk({ verified: true });
  });
}
