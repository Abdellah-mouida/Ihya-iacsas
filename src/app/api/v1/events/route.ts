import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { toEventDTO } from "@/lib/api/v1/dto";
import {
  ApiError,
  jsonOk,
  parseJsonBody,
  parsePagination,
} from "@/lib/api/v1/errors";
import { getOptionalApiActor, requireApiActor } from "@/lib/api/v1/guard";
import {
  createEventForActor,
  listPublicEventsForViewer,
} from "@/lib/services/events";

const createEventSchema = z.object({
  titleAr: z.string().min(1).max(200),
  titleEn: z.string().min(1).max(200),
  descriptionAr: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  date: z.string().min(4).max(64),
  time: z.string().max(32).optional(),
  location: z.string().min(1).max(200),
  posterUrl: z.string().max(500).nullable().optional(),
  isNew: z.boolean().optional(),
  bookingOpen: z.boolean().optional(),
  capacityType: z.enum(["OPEN", "LIMITED"]).optional(),
  capacity: z.number().int().positive().nullable().optional(),
  slug: z.string().max(100).optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await getOptionalApiActor(request);
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const { events, total } = await listPublicEventsForViewer({
      viewerUserId: actor?.id ?? null,
      skip,
      take: limit,
    });

    return jsonOk(
      {
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      actor
        ? undefined
        : { cacheControl: "public, s-maxage=30, stale-while-revalidate=60" },
    );
  });
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "events:create" });
    const body = await parseJsonBody(request, createEventSchema);

    const result = await createEventForActor(actor, body);
    if (!result.success) {
      throw new ApiError(result.status, "VALIDATION_ERROR", result.error);
    }

    return jsonOk({ event: toEventDTO(result.event) }, { status: 201 });
  });
}
