import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { leaveRoom } from "@/lib/chat/rooms";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  try {
    const result = await leaveRoom(authResult.user.id, id);
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to leave room");
  }
}
