import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import { getUnreadBadgeCounts } from "@/lib/chat/messages";

export async function GET() {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  const counts = await getUnreadBadgeCounts(authResult.user.id);
  return NextResponse.json(counts, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
