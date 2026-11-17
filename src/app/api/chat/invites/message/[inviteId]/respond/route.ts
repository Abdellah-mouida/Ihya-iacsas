import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireChatActor } from "@/lib/chat/guards";
import { respondToMessageInvite } from "@/lib/chat/rooms";

const respondSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { inviteId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  try {
    const result = await respondToMessageInvite(
      authResult.user.id,
      inviteId,
      parsed.data.decision,
    );
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to respond to invite");
  }
}
