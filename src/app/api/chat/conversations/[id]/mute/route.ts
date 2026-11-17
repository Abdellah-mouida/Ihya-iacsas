import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import { setConversationMuted } from "@/lib/chat/messages";

const muteSchema = z.object({
  muted: z.boolean(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = muteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mute value" }, { status: 400 });
  }

  try {
    const muted = await setConversationMuted({
      userId: authResult.user.id,
      conversationId: id,
      muted: parsed.data.muted,
    });
    return NextResponse.json({ ok: true, muted });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to update mute preference" },
      { status: 500 },
    );
  }
}
