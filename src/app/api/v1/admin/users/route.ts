import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parsePagination } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { listAdminUsersForActor } from "@/lib/services/users";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "users:view" });
    const url = new URL(request.url);
    const { page, limit } = parsePagination(url, {
      defaultLimit: 10,
      maxLimit: 100,
    });
    const search = url.searchParams.get("search") ?? undefined;
    const role = url.searchParams.get("role") ?? undefined;

    const result = await listAdminUsersForActor(actor, {
      page,
      limit,
      search,
      role,
    });

    return jsonOk(result);
  });
}
