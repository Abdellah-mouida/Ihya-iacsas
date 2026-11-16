import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { extractClientIpFromHeaders } from "@/lib/request-ip";
import { registerUserWithCredentials } from "@/lib/services/auth";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  termsAccepted: z.boolean(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, registerSchema);
    const result = await registerUserWithCredentials({
      name: body.name,
      email: body.email,
      password: body.password,
      termsAccepted: body.termsAccepted,
      locale: body.locale,
      clientIp: extractClientIpFromHeaders(request.headers),
    });

    if (!result.success) {
      const code =
        result.status === 409
          ? "EMAIL_EXISTS"
          : result.status === 429
            ? "RATE_LIMITED"
            : result.status === 502
              ? "EMAIL_DELIVERY_FAILED"
              : "VALIDATION_ERROR";
      throw new ApiError(result.status ?? 400, code, result.error ?? "Registration failed");
    }

    return jsonOk(
      {
        registered: true,
        email: result.email,
        verificationRequired: true,
      },
      { status: 201 },
    );
  });
}
