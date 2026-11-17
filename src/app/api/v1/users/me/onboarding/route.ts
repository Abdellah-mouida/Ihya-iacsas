import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  completeOnboardingForUser,
  getSelfUserProfile,
} from "@/lib/services/users";

const onboardingSchema = z.object({
  city: z.string().min(1).max(100),
  age: z.number().int().min(10).max(120),
  name: z.string().min(2).max(100).optional(),
  termsAccepted: z.boolean(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const body = await parseJsonBody(request, onboardingSchema);

    const result = await completeOnboardingForUser({
      userId: actor.id,
      city: body.city,
      age: body.age,
      name: body.name,
      termsAccepted: body.termsAccepted,
      locale: body.locale,
    });

    if (!result.success) {
      throw new ApiError(
        result.status ?? 400,
        "VALIDATION_ERROR",
        result.error ?? "Onboarding failed",
      );
    }

    const user = await getSelfUserProfile(actor.id);
    return jsonOk({ onboardingCompleted: true, user });
  });
}
