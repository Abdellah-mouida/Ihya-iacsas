import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { transferRoomOwnership } from "@/lib/chat/rooms";

const transferSchema = z.object({
  newOwnerId: z.string().trim().min(1).max(64),
});

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

  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  try {
    await transferRoomOwnership(
      authResult.user.id,
      id,
      parsed.data.newOwnerId,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return chatErrorResponse(err, "Failed to transfer ownership");
  }
}
