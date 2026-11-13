import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { inspectLinkInvite } from "@/lib/chat/rooms";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: false });
  if (!authResult.ok) return authResult.response;

  const { token } = await context.params;
  try {
    const preview = await inspectLinkInvite(authResult.user.id, token);
    return NextResponse.json(
      { invite: preview },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return chatErrorResponse(err, "Invite is invalid or unavailable");
  }
}
