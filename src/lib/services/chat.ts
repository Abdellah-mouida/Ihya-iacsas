import { z } from "zod";
import { touchUserActive } from "@/lib/activity";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  unblockUser,
  unfriendUser,
} from "@/lib/chat/friends";
import { isChatEnabled } from "@/lib/chat/guards";
import {
  canUserAccessConversation,
  conversationChannel,
  getAuthorizedChannelsForUser,
  getRealtimeProviderKind,
  getRealtimeTransport,
  userChannel,
} from "@/lib/chat/realtime";
import {
  getLocalOnlineUserIds,
  subscribeLocalChannels,
  trackLocalSseConnection,
  updateLocalPresence,
  verifyLocalRealtimeToken,
} from "@/lib/chat/realtime/local-sse";
import { notify } from "@/lib/notifications";
import { publishChange } from "@/lib/realtime/publish";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export const friendActionSchema = z.object({
  action: z.enum([
    "send",
    "cancel",
    "accept",
    "decline",
    "unfriend",
    "block",
    "unblock",
  ]),
  targetUserId: z.string().trim().min(1).max(64),
});

export type FriendAction = z.infer<typeof friendActionSchema>["action"];

export async function executeFriendAction(params: {
  actorId: string;
  actorName: string | null;
  action: FriendAction;
  targetUserId: string;
}): Promise<Record<string, unknown>> {
  const { actorId, actorName, action, targetUserId } = params;

  let result: Record<string, unknown>;
  switch (action) {
    case "send":
      result = await sendFriendRequest(actorId, targetUserId);
      break;
    case "cancel":
      result = await cancelFriendRequest(actorId, targetUserId);
      break;
    case "accept":
      result = await acceptFriendRequest(actorId, targetUserId);
      break;
    case "decline":
      result = await declineFriendRequest(actorId, targetUserId);
      break;
    case "unfriend":
      result = await unfriendUser(actorId, targetUserId);
      break;
    case "block":
      result = await blockUser(actorId, targetUserId);
      break;
    case "unblock":
      result = await unblockUser(actorId, targetUserId);
      break;
  }

  const kindMap = {
    send: result.autoAccepted ? "accepted" : "requested",
    cancel: "canceled",
    accept: "accepted",
    decline: "declined",
    unfriend: "unfriended",
    block: "blocked",
    unblock: "unblocked",
  } as const;

  const kind = kindMap[action];
  await Promise.all([
    publishChange([userChannel(targetUserId), userChannel(actorId)], {
      type: "friend.changed",
      kind,
      actorId,
    }),
    publishChange([userChannel(targetUserId), userChannel(actorId)], {
      type: "unread.sync",
    }),
  ]);

  if (action === "send") {
    if (result.autoAccepted) {
      await notify(targetUserId, "FRIEND_REQUEST_ACCEPTED", {
        params: { actorName: actorName ?? "" },
        data: { actorId },
        dedupeKey: `friend-accept:${actorId}:${targetUserId}`,
      });
    } else if (!result.alreadyExists) {
      await notify(targetUserId, "FRIEND_REQUEST_RECEIVED", {
        params: { actorName: actorName ?? "" },
        data: { actorId },
        dedupeKey: `friend-req:${actorId}:${targetUserId}`,
      });
    }
  } else if (action === "accept") {
    await notify(targetUserId, "FRIEND_REQUEST_ACCEPTED", {
      params: { actorName: actorName ?? "" },
      data: { actorId },
      dedupeKey: `friend-accept:${actorId}:${targetUserId}`,
    });
  }

  return { ok: true, ...result };
}

const globalThrottle = globalThis as typeof globalThis & {
  __ihyaaTypingThrottle?: Map<string, number>;
};

function getTypingThrottleMap(): Map<string, number> {
  if (!globalThrottle.__ihyaaTypingThrottle) {
    globalThrottle.__ihyaaTypingThrottle = new Map();
  }
  return globalThrottle.__ihyaaTypingThrottle;
}

export async function publishTypingEvent(params: {
  actorId: string;
  showOnlineStatus: boolean;
  conversationId: string;
  isTyping: boolean;
}): Promise<
  | { ok: true; suppressed?: boolean; throttled?: boolean }
  | { ok: false; status: 404; error: string }
> {
  if (!params.showOnlineStatus) {
    return { ok: true, suppressed: true };
  }

  const access = await canUserAccessConversation(
    params.actorId,
    params.conversationId,
  );
  if (!access.ok) {
    return { ok: false, status: 404, error: "Not found" };
  }

  const throttleKey = `${params.actorId}:${params.conversationId}`;
  const map = getTypingThrottleMap();
  const now = Date.now();
  if (map.size > 1000) {
    for (const [key, ts] of map.entries()) {
      if (now - ts > 60_000) map.delete(key);
    }
    while (map.size >= 2000) {
      const oldestKey = map.keys().next().value;
      if (!oldestKey) break;
      map.delete(oldestKey);
    }
  }
  const prev = map.get(throttleKey) ?? 0;

  if (params.isTyping && now - prev < 1500) {
    return { ok: true, throttled: true };
  }

  const rl = await checkRateLimit(`chat_typing:${params.actorId}`, 40, 60);
  if (!rl.allowed) {
    return { ok: true, throttled: true };
  }

  if (params.isTyping) {
    map.set(throttleKey, now);
  } else {
    map.delete(throttleKey);
  }

  try {
    const transport = getRealtimeTransport();
    const targets = [conversationChannel(params.conversationId)];
    if (access.conversationType === "DM" && access.dmPeerId) {
      targets.push(userChannel(access.dmPeerId));
    }
    await Promise.all(
      targets.map((ch) =>
        transport.publish(ch, {
          type: "typing",
          conversationId: params.conversationId,
          userId: params.actorId,
          isTyping: params.isTyping,
          at: now,
        }),
      ),
    );
  } catch (err) {
    console.error("Failed to publish typing event:", err);
  }

  return { ok: true };
}

export async function getOnlineUsersForChat(): Promise<{
  onlineUserIds: string[];
}> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const recentUsers = await prisma.user.findMany({
    where: {
      showOnlineStatus: true,
      chatBannedAt: null,
      lastActiveAt: { gte: twoMinutesAgo },
    },
    select: { id: true },
    take: 200,
  });

  const merged = new Set(recentUsers.map((u) => u.id));
  if (getRealtimeProviderKind() === "local") {
    for (const id of getLocalOnlineUserIds()) {
      merged.add(id);
    }
  }

  return { onlineUserIds: Array.from(merged) };
}

export async function updatePresenceForChat(params: {
  actorId: string;
  showOnlineStatus: boolean;
  online: boolean;
}): Promise<{
  ok: true;
  throttled?: boolean;
  suppressed?: boolean;
  onlineUserIds?: string[];
}> {
  const rl = await checkRateLimit(`chat_presence:${params.actorId}`, 30, 60);
  if (!rl.allowed) {
    return { ok: true, throttled: true };
  }

  if (params.online && params.showOnlineStatus) {
    await touchUserActive(params.actorId);
  }

  let onlineUserIds: string[] = [];
  if (getRealtimeProviderKind() === "local") {
    onlineUserIds = updateLocalPresence(
      params.actorId,
      params.online,
      params.showOnlineStatus,
    );
  }

  return {
    ok: true,
    suppressed: !params.showOnlineStatus,
    onlineUserIds,
  };
}

export async function getChatBackfill(params: {
  userId: string;
  conversationId: string | null;
  afterMessageId: string | null;
  sinceRaw: string | null;
}): Promise<
  | {
      ok: true;
      serverTime: string;
      items: Array<{
        messageId: string;
        conversationId: string;
        senderId: string | null;
        createdAt: string;
        editedAt: string | null;
        deletedAt: string | null;
      }>;
    }
  | { ok: false; status: 404; error: string }
> {
  let sinceDate: Date | null = null;
  if (params.sinceRaw) {
    const parsed = new Date(params.sinceRaw);
    if (!Number.isNaN(parsed.getTime())) {
      sinceDate = parsed;
    }
  }

  let targetConvIds: string[] = [];
  if (params.conversationId) {
    const access = await canUserAccessConversation(
      params.userId,
      params.conversationId,
    );
    if (!access.ok) {
      return { ok: false, status: 404, error: "Not found" };
    }
    targetConvIds = [params.conversationId];
  } else {
    const authz = await getAuthorizedChannelsForUser(params.userId);
    targetConvIds = authz.conversationIds;
  }

  if (targetConvIds.length === 0) {
    return {
      ok: true,
      serverTime: new Date().toISOString(),
      items: [],
    };
  }

  if (params.conversationId && params.afterMessageId) {
    const anchor = await prisma.message.findFirst({
      where: { id: params.afterMessageId, conversationId: params.conversationId },
      select: { id: true, createdAt: true },
    });
    if (anchor) {
      const missed = await prisma.message.findMany({
        where: {
          conversationId: params.conversationId,
          OR: [
            { createdAt: { gt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { gt: anchor.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
        },
      });
      return {
        ok: true,
        serverTime: new Date().toISOString(),
        items: missed.map((m) => ({
          messageId: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          createdAt: m.createdAt.toISOString(),
          editedAt: m.editedAt?.toISOString() ?? null,
          deletedAt: m.deletedAt?.toISOString() ?? null,
        })),
      };
    }
  }

  const fallbackSince = sinceDate ?? new Date(Date.now() - 5 * 60 * 1000);
  const missed = await prisma.message.findMany({
    where: {
      conversationId: { in: targetConvIds },
      createdAt: { gt: fallbackSince },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
    },
  });

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    items: missed.map((m) => ({
      messageId: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      createdAt: m.createdAt.toISOString(),
      editedAt: m.editedAt?.toISOString() ?? null,
      deletedAt: m.deletedAt?.toISOString() ?? null,
    })),
  };
}

const STREAM_TTL_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 25_000;

export async function createLocalSseStreamResponse(params: {
  request: Request;
  user: {
    id: string;
    chatBannedAt: Date | null;
    onboardingCompletedAt: Date | null;
    chatTermsAcceptedAt: Date | null;
  };
}): Promise<
  | { ok: true; response: Response }
  | { ok: false; status: 403 | 404; code: string; error: string }
> {
  if (getRealtimeProviderKind() !== "local") {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      error: "SSE stream is only active in local realtime mode",
    };
  }

  const userId = params.user.id;
  const headerToken = params.request.headers.get("x-realtime-token");

  let channels: string[];
  let allowPresence = false;
  let expiresAt = Date.now() + STREAM_TTL_MS;

  if (headerToken) {
    const verified = verifyLocalRealtimeToken(headerToken);
    if (!verified || verified.sub !== userId) {
      return {
        ok: false,
        status: 403,
        code: "FORBIDDEN",
        error: "Invalid realtime token",
      };
    }
    const chatEnabled = await isChatEnabled();
    channels = verified.ch;
    allowPresence =
      verified.onl &&
      chatEnabled &&
      !params.user.chatBannedAt &&
      Boolean(params.user.onboardingCompletedAt) &&
      Boolean(params.user.chatTermsAcceptedAt);
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

      const ttlMs = Math.max(
        5_000,
        Math.min(STREAM_TTL_MS, expiresAt - Date.now()),
      );
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

      params.request.signal.addEventListener("abort", () => {
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

  return {
    ok: true,
    response: new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }),
  };
}
