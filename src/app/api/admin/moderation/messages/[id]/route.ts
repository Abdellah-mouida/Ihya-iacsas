import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { moderateDeletePublicMessage } from "@/lib/chat/moderation";

const deleteBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  let reason: string | undefined;
  const rawBody = await req.json().catch(() => null);
  if (rawBody && typeof rawBody === "object") {
    const parsed = deleteBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }
    reason = parsed.data.reason;
  }

  try {
    const deleted = await moderateDeletePublicMessage({
      messageId: id,
      actor: authResult.actor,
      reason,
    });
    return NextResponse.json({ deleted });
  } catch (err) {
    return chatErrorResponse(err, "Failed to delete public message");
  }
}
