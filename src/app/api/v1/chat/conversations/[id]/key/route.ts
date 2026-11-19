import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import {
  exportConversationKeyMaterial,
  loadKeyringFromEnv,
} from "@/lib/chat/crypto";
import { canUserAccessConversation } from "@/lib/chat/realtime/channels";

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request, {
      requireChatEnabled: true,
      requireChatTerms: true,
    });
    const { id } = await context.params;
    if (!id || id.length > 64) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }

    const access = await canUserAccessConversation(actor.id, id);
    if (!access.ok) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }

    const keyring = loadKeyringFromEnv();
    const currentEpoch =
      access.keyEpoch && access.keyEpoch > 1 ? access.keyEpoch : 1;
    const url = new URL(request.url);
    const requestedEpochRaw = Number(url.searchParams.get("epoch") ?? "");
    const epochs = new Set<number>([currentEpoch]);
    if (
      Number.isInteger(requestedEpochRaw) &&
      requestedEpochRaw >= 1 &&
      requestedEpochRaw <= currentEpoch
    ) {
      epochs.add(requestedEpochRaw);
    }

    const keys = [];
    for (const keyVersion of keyring.keys.keys()) {
      for (const keyEpoch of epochs) {
        keys.push(
          exportConversationKeyMaterial({
            conversationId: id,
            keyVersion,
            keyEpoch,
            keyring,
          }),
        );
      }
    }

    return jsonOk({
      conversationId: id,
      keyVersion: keyring.activeVersion,
      keyEpoch: currentEpoch,
      keys,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
  });
}
