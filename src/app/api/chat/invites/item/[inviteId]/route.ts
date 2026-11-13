import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { revokeInvite } from "@/lib/chat/rooms";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { inviteId } = await context.params;
  try {
    await revokeInvite(authResult.user.id, inviteId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return chatErrorResponse(err, "Failed to revoke invite");
  }
}
