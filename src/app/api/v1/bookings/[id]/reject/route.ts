import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { rejectBookingForActor } from "@/lib/services/bookings";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "bookings:manage" });
    const { id } = await context.params;
    const result = await rejectBookingForActor(actor, id);
    if (!result.success) {
      throw new ApiError(result.status, "NOT_FOUND", result.error);
    }
    return jsonOk(result);
  });
}
