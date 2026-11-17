import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { toEventDTO } from "@/lib/api/v1/dto";
import { ApiError, jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { getOptionalApiActor, requireApiActor } from "@/lib/api/v1/guard";
import {
  deleteEventForActor,
  getEventByIdOrSlugForViewer,
  updateEventForActor,
} from "@/lib/services/events";

const updateEventSchema = z.object({
  titleAr: z.string().min(1).max(200).optional(),
  titleEn: z.string().min(1).max(200).optional(),
  descriptionAr: z.string().max(5000).optional(),
  descriptionEn: z.string().max(5000).optional(),
  date: z.string().min(4).max(64).optional(),
  time: z.string().max(32).optional(),
  location: z.string().min(1).max(200).optional(),
  posterUrl: z.string().max(500).nullable().optional(),
  isNew: z.boolean().optional(),
  bookingOpen: z.boolean().optional(),
  capacityType: z.enum(["OPEN", "LIMITED"]).optional(),
  capacity: z.number().int().positive().nullable().optional(),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await getOptionalApiActor(request);
    const { id } = await context.params;
    const event = await getEventByIdOrSlugForViewer(id, actor?.id ?? null);
    if (!event) {
      throw new ApiError(404, "NOT_FOUND", "Event not found");
    }
    return jsonOk({ event });
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "events:update" });
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateEventSchema);
    const result = await updateEventForActor(actor, id, body);
    if (!result.success) {
      throw new ApiError(
        result.status,
        result.status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR",
        result.error,
      );
    }
    return jsonOk({ event: toEventDTO(result.event) });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "events:delete" });
    const { id } = await context.params;
    const result = await deleteEventForActor(actor, id);
    if (!result.success) {
      throw new ApiError(result.status, "NOT_FOUND", result.error);
    }
    return jsonOk({ deleted: true, id });
  });
}
