import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { createRoom } from "@/lib/chat/rooms";

export async function POST(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const room = await createRoom(authResult.user.id, body as never);
    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    return chatErrorResponse(err, "Failed to create room");
  }
}
