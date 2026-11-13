import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import {
  getAuthorizedChannelsForUser,
  getRealtimeTransport,
} from "@/lib/chat/realtime";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function GET() {
  const authResult = await requireChatActor({ requireTerms: false });
  if (!authResult.ok) return authResult.response;

  try {
    const authz = await getAuthorizedChannelsForUser(authResult.user.id);
    const transport = getRealtimeTransport();
    const token = await transport.issueClientToken({
      userId: authResult.user.id,
      channels: authz.channels,
      showOnlineStatus: authz.showOnlineStatus,
      ttlMs: TOKEN_TTL_MS,
    });

    return NextResponse.json(token, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("Failed to issue realtime token:", err);
    return NextResponse.json(
      { error: "Realtime token unavailable" },
      { status: 500 },
    );
  }
}
