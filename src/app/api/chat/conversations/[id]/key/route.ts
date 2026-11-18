import { NextResponse } from "next/server";
import { exportConversationKeyMaterial, loadKeyringFromEnv } from "@/lib/chat/crypto";
import { requireChatActor } from "@/lib/chat/guards";
import { canUserAccessConversation } from "@/lib/chat/realtime/channels";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const access = await canUserAccessConversation(authResult.user.id, id);
  if (!access.ok) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  try {
    const keyring = loadKeyringFromEnv();
    const currentEpoch = access.keyEpoch && access.keyEpoch > 1 ? access.keyEpoch : 1;
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

    return NextResponse.json(
      {
        conversationId: id,
        keyVersion: keyring.activeVersion,
        keyEpoch: currentEpoch,
        keys,
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Conversation key unavailable" },
      { status: 500 },
    );
  }
}
