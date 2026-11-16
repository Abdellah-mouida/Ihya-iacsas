import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { toBookingDTO } from "@/lib/api/v1/dto";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { can } from "@/lib/permissions";
import {
  cancelBookingForUser,
  getBookingByIdForActor,
} from "@/lib/services/bookings";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;
    const booking = await getBookingByIdForActor(actor, id);
    if (!booking) {
      throw new ApiError(404, "NOT_FOUND", "Booking not found");
    }

    const dto = toBookingDTO(booking);
    if (can(actor.role, "bookings:view")) {
      return jsonOk({
        booking: {
          ...dto,
          userId: booking.userId,
          fullName: booking.fullName,
          email: booking.email,
          city: booking.city,
          age: booking.age,
        },
      });
    }
    return jsonOk({ booking: dto });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const { id } = await context.params;

    const result = await cancelBookingForUser({
      userId: actor.id,
      userEmail: actor.email,
      userName: actor.name,
      bookingId: id,
    });

    if (!result.success) {
      if (result.notFound) {
        throw new ApiError(404, "NOT_FOUND", result.error);
      }
      if (result.forbidden) {
        throw new ApiError(403, "FORBIDDEN", result.error);
      }
      throw new ApiError(400, "CANCEL_FAILED", result.error);
    }

    return jsonOk({ cancelled: true, id });
  });
}
