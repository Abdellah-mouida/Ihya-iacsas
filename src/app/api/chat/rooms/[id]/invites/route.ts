import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { createRoomInvite } from "@/lib/chat/rooms";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await createRoomInvite(authResult.user.id, id, body as never);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return chatErrorResponse(err, "Failed to create invite");
  }
}
