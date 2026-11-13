import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import { openOrCreateDmConversation } from "@/lib/chat/messages";

const dmSchema = z.object({
  peerId: z.string().trim().min(1).max(64),
});

export async function POST(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = dmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid peer user id" },
      { status: 400 },
    );
  }

  try {
    const conversation = await openOrCreateDmConversation(
      authResult.user.id,
      parsed.data.peerId,
    );
    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to open direct conversation" },
      { status: 500 },
    );
  }
}
