import { NextResponse } from "next/server";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { setUserChatBan } from "@/lib/chat/moderation";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
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
    const result = await setUserChatBan({
      targetUserId: id,
      banned: Boolean(payload.banned),
      actor: authResult.actor,
      reason: typeof payload.reason === "string" ? payload.reason : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to update chat ban status");
  }
}
