import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { extractClientIpFromHeaders } from "@/lib/request-ip";
import { submitContactMessageService } from "@/lib/services/contacts";

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  message: z.string().min(3).max(2000),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const body = await parseJsonBody(request, contactSchema);
    const result = await submitContactMessageService({
      name: body.name,
      email: body.email,
      message: body.message,
      ip: extractClientIpFromHeaders(request.headers),
    });

    if (!result.success) {
      throw new ApiError(
        result.status,
        result.status === 429 ? "RATE_LIMITED" : "VALIDATION_ERROR",
        result.error,
      );
    }

    return jsonOk(
      {
        contact: {
          id: result.contact.id,
          createdAt: result.contact.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  });
}
