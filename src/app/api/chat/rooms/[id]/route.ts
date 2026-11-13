import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import {
  deleteRoom,
  getRoomDetails,
  updateRoomSettings,
} from "@/lib/chat/rooms";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  try {
    const room = await getRoomDetails(authResult.user.id, id);
    return NextResponse.json(
      { room },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return chatErrorResponse(err, "Failed to load room");
  }
}

export async function PATCH(
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
    const room = await updateRoomSettings(authResult.user.id, id, body as never);
    return NextResponse.json({ room });
  } catch (err) {
    return chatErrorResponse(err, "Failed to update room");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  try {
    await deleteRoom(authResult.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return chatErrorResponse(err, "Failed to delete room");
  }
}
