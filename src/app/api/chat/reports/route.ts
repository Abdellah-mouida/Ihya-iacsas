import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { reportMessage } from "@/lib/chat/moderation";

const reportSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const actor = await requireChatActor({ requireTerms: true });
  if (!actor.ok) return actor.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report payload" },
      { status: 400 },
    );
  }

  try {
    const report = await reportMessage({
      reporterId: actor.user.id,
      reporterName: actor.user.name,
      reporterRole: actor.user.role,
      messageId: parsed.data.messageId,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return chatErrorResponse(err, "Failed to submit report");
  }
}
