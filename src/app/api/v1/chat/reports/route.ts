import { z } from "zod";
import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { jsonOk, parseJsonBody } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { reportMessage } from "@/lib/chat/moderation";

const reportSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(1).max(500),
});

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const body = await parseJsonBody(request, reportSchema);
    const report = await reportMessage({
      reporterId: actor.id,
      reporterName: actor.name,
      reporterRole: actor.role,
      messageId: body.messageId,
      reason: body.reason,
    });
    return jsonOk({ report }, { status: 201 });
  });
}
