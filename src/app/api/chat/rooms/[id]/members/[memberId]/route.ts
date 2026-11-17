import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { removeRoomMember } from "@/lib/chat/rooms";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; memberId: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id, memberId } = await context.params;
  try {
    await removeRoomMember(authResult.user.id, id, memberId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return chatErrorResponse(err, "Failed to remove member");
  }
}
