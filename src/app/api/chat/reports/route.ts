import { NextResponse } from "next/server";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { reportMessage } from "@/lib/chat/moderation";

export async function POST(req: Request) {
  const actor = await requireChatActor({ requireTerms: true });
  if (!actor.ok) return actor.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload =
    body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : {};

  try {
    const report = await reportMessage({
      reporterId: actor.user.id,
      reporterName: actor.user.name,
      reporterRole: actor.user.role,
      messageId: typeof payload.messageId === "string" ? payload.messageId : "",
      reason: typeof payload.reason === "string" ? payload.reason : "",
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return chatErrorResponse(err, "Failed to submit report");
  }
}
