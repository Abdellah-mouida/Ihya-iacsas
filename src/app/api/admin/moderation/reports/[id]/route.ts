import { NextResponse } from "next/server";
import { chatErrorResponse, requireAdminApiPermission } from "@/lib/chat/guards";
import { resolveChatReport } from "@/lib/chat/moderation";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminApiPermission("chat:moderate");
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
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
    const report = await resolveChatReport({
      reportId: id,
      actor: authResult.actor,
      status: payload.status as "RESOLVED" | "DISMISSED",
      resolutionNote:
        typeof payload.resolutionNote === "string"
          ? payload.resolutionNote
          : undefined,
    });
    return NextResponse.json({ report });
  } catch (err) {
    return chatErrorResponse(err, "Failed to resolve report");
  }
}
