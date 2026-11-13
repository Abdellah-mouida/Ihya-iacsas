import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import {
  getAuthorizedChannelsForUser,
  getRealtimeProviderKind,
} from "@/lib/chat/realtime";
import {
  getLocalOnlineUserIds,
  subscribeLocalChannels,
  trackLocalSseConnection,
  verifyLocalRealtimeToken,
} from "@/lib/chat/realtime/local-sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_TTL_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const authResult = await requireChatActor({ requireTerms: false });
  if (!authResult.ok) return authResult.response;

  if (getRealtimeProviderKind() !== "local") {
    return NextResponse.json(
      { error: "SSE stream is only active in local realtime mode" },
      { status: 404 },
    );
  }

  const userId = authResult.user.id;
  const headerToken = request.headers.get("x-realtime-token");

  let channels: string[];
  let allowPresence = false;
  let expiresAt = Date.now() + STREAM_TTL_MS;

  if (headerToken) {
    const verified = verifyLocalRealtimeToken(headerToken);
    if (!verified || verified.sub !== userId) {
      return NextResponse.json({ error: "Invalid realtime token" }, { status: 403 });
    }
    channels = verified.ch;
    allowPresence = verified.onl && Boolean(authResult.user.chatTermsAcceptedAt);
    expiresAt = verified.exp;
  } else {
    const authz = await getAuthorizedChannelsForUser(userId);
    channels = authz.channels;
    allowPresence = authz.showOnlineStatus && authz.termsAccepted;
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          cleanup?.();
        }
      };

      const untrackPresence = trackLocalSseConnection(userId, allowPresence);
      const unsubscribe = subscribeLocalChannels(channels, (envelope) => {
        safeEnqueue(
          `id: ${envelope.id}\nevent: message\ndata: ${JSON.stringify(envelope)}\n\n`,
        );
      });

      const pingTimer = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      const ttlMs = Math.max(5_000, Math.min(STREAM_TTL_MS, expiresAt - Date.now()));
      const ttlTimer = setTimeout(() => {
        safeEnqueue(`event: reconnect\ndata: {"reason":"ttl"}\n\n`);
        cleanup?.();
        try {
          controller.close();
        } catch {}
      }, ttlMs);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pingTimer);
        clearTimeout(ttlTimer);
        unsubscribe();
        untrackPresence();
      };

      request.signal.addEventListener("abort", () => {
        cleanup?.();
      });

      safeEnqueue(
        `event: ready\ndata: ${JSON.stringify({
          channels,
          expiresAt,
          onlineUserIds: getLocalOnlineUserIds(),
        })}\n\n`,
      );
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
