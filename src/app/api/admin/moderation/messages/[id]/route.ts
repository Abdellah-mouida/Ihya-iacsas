import { NextResponse } from "next/server";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { moderateDeletePublicMessage } from "@/lib/chat/moderation";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  let reason: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (typeof body.reason === "string") {
      reason = body.reason;
    }
  } catch {
    reason = undefined;
  }

  try {
    const deleted = await moderateDeletePublicMessage({
      messageId: id,
      actor: authResult.actor,
      reason,
    });
    return NextResponse.json({ deleted });
  } catch (err) {
    return chatErrorResponse(err, "Failed to delete public message");
  }
}
