import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import { listConversationsForUser } from "@/lib/chat/messages";

export async function GET() {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  try {
    const result = await listConversationsForUser(authResult.user.id);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 },
    );
  }
}
