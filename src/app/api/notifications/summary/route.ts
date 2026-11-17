import { NextResponse } from "next/server";
import { requireRealtimeActor } from "@/lib/chat/guards";
import { getNotificationSummaryForUser } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const authResult = await requireRealtimeActor();
  if (!authResult.ok) return authResult.response;

  try {
    const summary = await getNotificationSummaryForUser(authResult.user.id);
    return NextResponse.json(summary, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("Failed to fetch notification summary:", err);
    return NextResponse.json(
      { error: "Failed to fetch notification summary" },
      { status: 500 },
    );
  }
}
