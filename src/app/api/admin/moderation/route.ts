import { NextResponse } from "next/server";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { listChatModerationDashboard } from "@/lib/chat/moderation";

export async function GET(req: Request) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status");
  const status =
    rawStatus === "OPEN" ||
    rawStatus === "RESOLVED" ||
    rawStatus === "DISMISSED" ||
    rawStatus === "ALL"
      ? rawStatus
      : "OPEN";
  const search = url.searchParams.get("search") ?? "";

  try {
    const data = await listChatModerationDashboard({ status, search });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    return chatErrorResponse(err, "Failed to load moderation queue");
  }
}
