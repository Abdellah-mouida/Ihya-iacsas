import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { timeoutUserFromPublicChat } from "@/lib/chat/moderation";

const timeoutSchema = z.object({
  hours: z.number().finite().min(0).max(720),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = timeoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid timeout payload" },
      { status: 400 },
    );
  }

  try {
    const result = await timeoutUserFromPublicChat({
      targetUserId: id,
      hours: parsed.data.hours,
      actor: authResult.actor,
      reason: parsed.data.reason,
    });
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to update public chat timeout");
  }
}
