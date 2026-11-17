import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { toBookingDTO } from "@/lib/api/v1/dto";
import {
  ApiError,
  jsonOk,
  parseJsonBody,
  parsePagination,
} from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  createBookingForUser,
  listAdminBookingsForActor,
} from "@/lib/services/bookings";
import { getFormattedBookingsForUser } from "@/lib/services/users";

const createBookingSchema = z.object({
  eventId: z.string().min(1).max(128).optional(),
  motive: z.string().max(1000).optional(),
  locale: z.enum(["ar", "en"]).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");

    if (scope === "admin") {
      const actor = await requireApiActor(request, { permission: "bookings:view" });
      const { page, limit, skip } = parsePagination(url, {
        defaultLimit: 20,
        maxLimit: 100,
      });
      const eventId = url.searchParams.get("eventId")?.trim() || undefined;
      const status = url.searchParams.get("status")?.trim() || undefined;

      const { bookings, total } = await listAdminBookingsForActor(actor, {
        eventId,
        status,
        skip,
        take: limit,
      });

      return jsonOk({
        bookings: bookings.map((b) => ({
          ...toBookingDTO(b),
          userId: b.userId,
          fullName: b.fullName,
          email: b.email,
          city: b.city,
          age: b.age,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    }

    const actor = await requireApiActor(request);
    const bookings = await getFormattedBookingsForUser(actor.id, actor.email);
    return jsonOk({ bookings });
  });
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { requireOnboarding: true });
    const body = await parseJsonBody(request, createBookingSchema);

    const result = await createBookingForUser({
      userId: actor.id,
      eventId: body.eventId,
      motive: body.motive,
      locale: body.locale,
    });

    if (!result.success) {
      if (result.needsOnboarding) {
        throw new ApiError(403, "ONBOARDING_REQUIRED", result.error);
      }
      if (result.rateLimited) {
        throw new ApiError(429, "RATE_LIMITED", result.error);
      }
      if (result.alreadyBooked) {
        throw new ApiError(409, "ALREADY_BOOKED", result.error);
      }
      if (result.notFound) {
        throw new ApiError(404, "NOT_FOUND", result.error);
      }
      throw new ApiError(400, "BOOKING_FAILED", result.error);
    }

    return jsonOk(
      {
        bookingId: result.bookingId,
        bookingRef: result.bookingRef,
        status: result.status,
        waitlistOrder: result.waitlistOrder,
        eventId: result.eventId,
      },
      { status: 201 },
    );
  });
}
