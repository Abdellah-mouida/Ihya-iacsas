import { NextResponse } from "next/server";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import { markConversationRead } from "@/lib/chat/messages";

export async function POST(
  _request: Request,
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

  try {
    const lastReadAt = await markConversationRead({
      userId: authResult.user.id,
      conversationId: id,
    });
    return NextResponse.json({ ok: true, lastReadAt: lastReadAt.toISOString() });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to mark conversation read" },
      { status: 500 },
    );
  }
}
