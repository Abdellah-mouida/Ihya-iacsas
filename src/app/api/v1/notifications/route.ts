import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/notifications";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const rawLimit = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(50, Math.max(1, Math.trunc(rawLimit)))
      : 20;
    const filter = url.searchParams.get("filter") === "unread" ? "unread" : "all";

    const result = await listNotificationsForUser(actor.id, {
      cursor,
      limit,
      filter,
    });
    return jsonOk(result);
  });
}

export async function PATCH(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);
    const result = await markAllNotificationsRead(actor.id);
    return jsonOk(result);
  });
}
