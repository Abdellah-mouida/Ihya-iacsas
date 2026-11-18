import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import { markConversationDelivered } from "@/lib/chat/messages";

const deliveredSchema = z.object({
  at: z.string().datetime().optional(),
});

export async function POST(
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

  let parsedAt: string | undefined;
  try {
    const text = await request.text();
    if (text.trim()) {
      const parsed = deliveredSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      parsedAt = parsed.data.at;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const lastDeliveredAt = await markConversationDelivered({
      userId: authResult.user.id,
      conversationId: id,
      at: parsedAt,
    });
    return NextResponse.json({
      ok: true,
      lastDeliveredAt: lastDeliveredAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to mark conversation delivered" },
      { status: 500 },
    );
  }
}
