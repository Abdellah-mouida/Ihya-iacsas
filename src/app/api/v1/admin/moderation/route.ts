import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { listChatModerationDashboard } from "@/lib/chat/moderation";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(request: Request) {
  return withV1(request, async () => {
    await requireApiActor(request, { permission: "chat:moderate" });
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus === "OPEN" ||
      rawStatus === "RESOLVED" ||
      rawStatus === "DISMISSED" ||
      rawStatus === "ALL"
        ? rawStatus
        : "OPEN";
    const search = url.searchParams.get("search") ?? "";
    const data = await listChatModerationDashboard({ status, search });
    return jsonOk(data);
  });
}
