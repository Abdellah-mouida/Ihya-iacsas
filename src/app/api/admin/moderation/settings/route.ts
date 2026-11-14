import { NextResponse } from "next/server";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { setGlobalChatEnabled } from "@/lib/chat/moderation";

export async function PATCH(req: Request) {
  const authResult = await requireAdminApiPermission("settings:manage");
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  try {
    const result = await setGlobalChatEnabled({
      enabled: Boolean(payload.enabled),
      actor: authResult.actor,
    });
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to update chat availability");
  }
}
