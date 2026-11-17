import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parsePagination } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { listContactMessagesForActor } from "@/lib/services/contacts";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, { permission: "contacts:view" });
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const { messages, total } = await listContactMessagesForActor(actor, {
      skip,
      take: limit,
    });

    return jsonOk({
      messages: messages.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        message: m.message,
        createdAt: m.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  });
}
