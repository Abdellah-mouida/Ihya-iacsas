import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { setGlobalChatEnabled } from "@/lib/chat/moderation";

const settingsSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const authResult = await requireAdminApiPermission("settings:manage");
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings payload" },
      { status: 400 },
    );
  }

  try {
    const result = await setGlobalChatEnabled({
      enabled: parsed.data.enabled,
      actor: authResult.actor,
    });
    return NextResponse.json(result);
  } catch (err) {
    return chatErrorResponse(err, "Failed to update chat availability");
  }
}
