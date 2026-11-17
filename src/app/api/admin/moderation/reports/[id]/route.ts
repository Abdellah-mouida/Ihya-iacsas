import { NextResponse } from "next/server";
import { z } from "zod";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { resolveChatReport } from "@/lib/chat/moderation";

const resolveSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().trim().max(500).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report resolution payload" },
      { status: 400 },
    );
  }

  try {
    const report = await resolveChatReport({
      reportId: id,
      actor: authResult.actor,
      status: parsed.data.status,
      resolutionNote: parsed.data.resolutionNote,
    });
    return NextResponse.json({ report });
  } catch (err) {
    return chatErrorResponse(err, "Failed to resolve report");
  }
}
