import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptMessage, encryptMessage, loadKeyringFromEnv } from "./crypto-core";
import {
  assertFriendsAndUnblocked,
  canonicalPairKey,
  ChatServiceError,
  ONLINE_WINDOW_MS,
} from "./friends";
import { getRealtimeTransport } from "./realtime";
import {
  canUserAccessConversation,
  ensurePublicConversationMember,
} from "./realtime/channels";
import { conversationChannel, userChannel } from "./realtime/types";

export const MAX_MESSAGE_LENGTH = 2000;
export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 50;
export const PUBLIC_SLOW_MODE_SECONDS = 12;
export const MESSAGE_BURST_LIMIT = 8;
export const MESSAGE_BURST_WINDOW_SECONDS = 10;
export const MESSAGE_MINUTE_LIMIT = 45;
export const MESSAGE_MINUTE_WINDOW_SECONDS = 60;

const cursorSchema = z.object({
  t: z.string().datetime(),
  id: z.string().min(1).max(128),
});

export interface ChatMessageDTO {
  id: string;
  clientId: string | null;
  conversationId: string;
  senderId: string | null;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
    isOnline: boolean | null;
  } | null;
  isAnonymized: boolean;
  type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
  body: string;
  replyTo: {
    id: string;
    senderId: string | null;
    senderName: string | null;
    body: string;
    deleted: boolean;
  } | null;
  invite: {
    id: string;
    roomId: string;
    roomName: string | null;
    roomEmoji: string | null;
    roomAccentColor: string | null;
    inviterId: string;
    inviteeId: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
    expiresAt: string;
  } | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
}

export interface ConversationSummaryDTO {
  id: string;
  type: "PUBLIC" | "DM" | "ROOM";
  name: string | null;
  emoji: string | null;
  accentColor: string | null;
  ownerId: string | null;
  membersCanInvite: boolean;
  memberCount: number;
  muted: boolean;
  lastReadAt: string;
  lastMessageAt: string | null;
  unreadCount: number;
  peer: {
    id: string;
    name: string | null;
    image: string | null;
    isOnline: boolean | null;
    lastReadAt: string | null;
  } | null;
  lastMessage: {
    id: string;
    senderId: string | null;
    senderName: string | null;
    type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
    body: string;
    createdAt: string;
    deleted: boolean;
  } | null;
}

function computeOnline(
  showOnlineStatus: boolean | null | undefined,
  lastActiveAt: Date | null | undefined,
): boolean | null {
  if (!showOnlineStatus) return null;
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() <= ONLINE_WINDOW_MS;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ t: createdAt.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = cursorSchema.parse(JSON.parse(raw));
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) {
      throw new Error("Invalid date");
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new ChatServiceError("Invalid pagination cursor", 400, "INVALID_CURSOR");
  }
}

function safeDecryptRow(row: {
  id: string;
  conversationId: string;
  senderId: string | null;
  isAnonymized: boolean;
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  deletedAt: Date | null;
}): string {
  if (row.deletedAt || !row.ciphertext || !row.nonce) {
    return "";
  }
  const aadSender = row.isAnonymized ? "anonymized" : (row.senderId ?? "");
  return decryptMessage({
    ciphertext: row.ciphertext,
    nonce: row.nonce,
    keyVersion: row.keyVersion,
    conversationId: row.conversationId,
    messageId: row.id,
    senderId: aadSender,
  });
}

const messageInclude = {
  sender: {
    select: {
      id: true,
      name: true,
      image: true,
      showOnlineStatus: true,
      lastActiveAt: true,
    },
  },
  replyTo: {
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      isAnonymized: true,
      ciphertext: true,
      nonce: true,
      keyVersion: true,
      deletedAt: true,
      sender: {
        select: { name: true },
      },
    },
  },
  invite: {
    select: {
      id: true,
      roomId: true,
      inviterId: true,
      inviteeId: true,
      status: true,
      expiresAt: true,
      room: {
        select: {
          name: true,
          emoji: true,
          accentColor: true,
        },
      },
    },
  },
} satisfies Prisma.MessageInclude;

type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

function serializeMessage(row: MessageRow): ChatMessageDTO {
  const deleted = Boolean(row.deletedAt);
  const body = deleted ? "" : safeDecryptRow(row);

  const replyTo = row.replyTo
    ? {
        id: row.replyTo.id,
        senderId: row.replyTo.isAnonymized ? null : row.replyTo.senderId,
        senderName: row.replyTo.isAnonymized
          ? null
          : (row.replyTo.sender?.name ?? null),
        body: row.replyTo.deletedAt ? "" : safeDecryptRow(row.replyTo),
        deleted: Boolean(row.replyTo.deletedAt),
      }
    : null;

  const invite =
    !deleted && row.invite
      ? {
          id: row.invite.id,
          roomId: row.invite.roomId,
          roomName: row.invite.room.name,
          roomEmoji: row.invite.room.emoji,
          roomAccentColor: row.invite.room.accentColor,
          inviterId: row.invite.inviterId,
          inviteeId: row.invite.inviteeId,
          status:
            row.invite.status === "PENDING" &&
            row.invite.expiresAt.getTime() <= Date.now()
              ? ("EXPIRED" as const)
              : row.invite.status,
          expiresAt: row.invite.expiresAt.toISOString(),
        }
      : null;

  return {
    id: row.id,
    clientId: row.clientId,
    conversationId: row.conversationId,
    senderId: row.isAnonymized ? null : row.senderId,
    sender:
      row.isAnonymized || !row.sender
        ? null
        : {
            id: row.sender.id,
            name: row.sender.name,
            image: row.sender.image,
            isOnline: computeOnline(
              row.sender.showOnlineStatus,
              row.sender.lastActiveAt,
            ),
          },
    isAnonymized: row.isAnonymized,
    type: row.type,
    body,
    replyTo,
    invite,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    deleted,
  };
}

export async function acceptChatTerms(userId: string): Promise<Date> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatTermsAcceptedAt: true },
  });
  const acceptedAt = existing?.chatTermsAcceptedAt ?? new Date();
  if (!existing?.chatTermsAcceptedAt) {
    await prisma.user.update({
      where: { id: userId },
      data: { chatTermsAcceptedAt: acceptedAt },
    });
  }
  await ensurePublicConversationMember(userId);
  return acceptedAt;
}

export async function listConversationsForUser(userId: string): Promise<{
  conversations: ConversationSummaryDTO[];
  unreadTotal: number;
}> {
  const [user, initialMemberships, blocks, friendships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { chatTermsAcceptedAt: true, chatBannedAt: true },
    }),
    prisma.conversationMember.findMany({
      where: { userId, leftAt: null },
      select: {
        conversationId: true,
        muted: true,
        lastReadAt: true,
        conversation: {
          select: {
            id: true,
            type: true,
            name: true,
            emoji: true,
            accentColor: true,
            ownerId: true,
            membersCanInvite: true,
            dmPairKey: true,
            lastMessageAt: true,
          },
        },
      },
    }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { pairKey: true },
    }),
  ]);

  if (!user || user.chatBannedAt || !user.chatTermsAcceptedAt) {
    return { conversations: [], unreadTotal: 0 };
  }

  let memberships = initialMemberships;
  if (!memberships.some((m) => m.conversation.type === "PUBLIC")) {
    const pubId = await ensurePublicConversationMember(userId);
    if (pubId) {
      memberships = await prisma.conversationMember.findMany({
        where: { userId, leftAt: null },
        select: {
          conversationId: true,
          muted: true,
          lastReadAt: true,
          conversation: {
            select: {
              id: true,
              type: true,
              name: true,
              emoji: true,
              accentColor: true,
              ownerId: true,
              membersCanInvite: true,
              dmPairKey: true,
              lastMessageAt: true,
            },
          },
        },
      });
    }
  }

  const blockedSet = new Set<string>();
  for (const b of blocks) {
    blockedSet.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  const acceptedPairs = new Set(friendships.map((f) => f.pairKey));

  const validMemberships = memberships.filter((m) => {
    const conv = m.conversation;
    if (conv.type !== "DM") return true;
    if (!conv.dmPairKey || !acceptedPairs.has(conv.dmPairKey)) return false;
    const [a, b] = conv.dmPairKey.split(":");
    const peerId = a === userId ? b : a;
    return Boolean(peerId && !blockedSet.has(peerId));
  });

  if (validMemberships.length === 0) {
    return { conversations: [], unreadTotal: 0 };
  }

  const accessibleIds = validMemberships.map((m) => m.conversation.id);
  const dmIds = validMemberships
    .filter((m) => m.conversation.type === "DM")
    .map((m) => m.conversation.id);

  loadKeyringFromEnv();

  const [latestRows, unreadRows, memberCounts, dmPeers] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        conversationId: string;
        senderId: string | null;
        isAnonymized: boolean;
        type: "TEXT" | "ROOM_INVITE" | "SYSTEM";
        ciphertext: string;
        nonce: string;
        keyVersion: number;
        createdAt: Date;
        deletedAt: Date | null;
        senderName: string | null;
      }>
    >(Prisma.sql`
      SELECT DISTINCT ON (m."conversationId")
        m.id,
        m."conversationId",
        m."senderId",
        m."isAnonymized",
        m.type,
        m.ciphertext,
        m.nonce,
        m."keyVersion",
        m."createdAt",
        m."deletedAt",
        u.name AS "senderName"
      FROM "Message" m
      LEFT JOIN "User" u ON u.id = m."senderId"
      WHERE m."conversationId" IN (${Prisma.join(accessibleIds)})
        AND m."deletedAt" IS NULL
      ORDER BY m."conversationId", m."createdAt" DESC, m.id DESC
    `),
    prisma.$queryRaw<Array<{ conversationId: string; unread: number }>>(Prisma.sql`
      SELECT
        m."conversationId",
        COUNT(*)::int AS unread
      FROM "Message" m
      INNER JOIN "ConversationMember" cm
        ON cm."conversationId" = m."conversationId"
        AND cm."userId" = ${userId}
        AND cm."leftAt" IS NULL
      WHERE m."conversationId" IN (${Prisma.join(accessibleIds)})
        AND m."deletedAt" IS NULL
        AND (m."senderId" IS NULL OR m."senderId" <> ${userId})
        AND m."createdAt" > cm."lastReadAt"
      GROUP BY m."conversationId"
    `),
    prisma.conversationMember.groupBy({
      by: ["conversationId"],
      where: { conversationId: { in: accessibleIds }, leftAt: null },
      _count: { _all: true },
    }),
    dmIds.length > 0
      ? prisma.conversationMember.findMany({
          where: {
            conversationId: { in: dmIds },
            userId: { not: userId },
            leftAt: null,
          },
          select: {
            conversationId: true,
            lastReadAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                showOnlineStatus: true,
                lastActiveAt: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const latestMap = new Map(latestRows.map((r) => [r.conversationId, r]));
  const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.unread]));
  const countMap = new Map(
    memberCounts.map((c) => [c.conversationId, c._count._all]),
  );
  const dmPeerMap = new Map(dmPeers.map((p) => [p.conversationId, p]));

  let unreadTotal = 0;
  const conversations: ConversationSummaryDTO[] = validMemberships.map((m) => {
    const conv = m.conversation;
    const unreadCount = unreadMap.get(conv.id) ?? 0;
    if (!m.muted) {
      unreadTotal += unreadCount;
    }
    const latest = latestMap.get(conv.id);
    const peerMember = dmPeerMap.get(conv.id);

    return {
      id: conv.id,
      type: conv.type,
      name: conv.type === "DM" ? (peerMember?.user.name ?? conv.name) : conv.name,
      emoji: conv.emoji,
      accentColor: conv.accentColor,
      ownerId: conv.ownerId,
      membersCanInvite: conv.membersCanInvite,
      memberCount: countMap.get(conv.id) ?? 1,
      muted: m.muted,
      lastReadAt: m.lastReadAt.toISOString(),
      lastMessageAt: conv.lastMessageAt
        ? conv.lastMessageAt.toISOString()
        : null,
      unreadCount,
      peer: peerMember
        ? {
            id: peerMember.user.id,
            name: peerMember.user.name,
            image: peerMember.user.image,
            isOnline: computeOnline(
              peerMember.user.showOnlineStatus,
              peerMember.user.lastActiveAt,
            ),
            lastReadAt: peerMember.lastReadAt.toISOString(),
          }
        : null,
      lastMessage: latest
        ? {
            id: latest.id,
            senderId: latest.isAnonymized ? null : latest.senderId,
            senderName: latest.isAnonymized ? null : latest.senderName,
            type: latest.type,
            body: safeDecryptRow(latest),
            createdAt: latest.createdAt.toISOString(),
            deleted: Boolean(latest.deletedAt),
          }
        : null,
    };
  });

  conversations.sort((a, b) => {
    if (a.type === "PUBLIC" && b.type !== "PUBLIC") return -1;
    if (b.type === "PUBLIC" && a.type !== "PUBLIC") return 1;
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });

  return { conversations, unreadTotal };
}

export async function getUnreadBadgeCounts(userId: string): Promise<{
  unreadCount: number;
  pendingRequestsCount: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatTermsAcceptedAt: true, chatBannedAt: true },
  });

  if (!user || user.chatBannedAt) {
    return { unreadCount: 0, pendingRequestsCount: 0 };
  }

  const pendingRequestsCount = await prisma.friendship.count({
    where: { addresseeId: userId, status: "PENDING" },
  });

  if (!user.chatTermsAcceptedAt) {
    return { unreadCount: 0, pendingRequestsCount };
  }

  const summary = await listConversationsForUser(userId);
  return {
    unreadCount: summary.unreadTotal,
    pendingRequestsCount,
  };
}

export async function openOrCreateDmConversation(
  userId: string,
  peerId: string,
): Promise<ConversationSummaryDTO> {
  await assertFriendsAndUnblocked(userId, peerId);
  const dmPairKey = canonicalPairKey(userId, peerId);

  const dmSelect = {
    id: true,
    type: true,
    emoji: true,
    accentColor: true,
    ownerId: true,
    membersCanInvite: true,
    lastMessageAt: true,
  } as const;

  let conv = await prisma.conversation.findUnique({
    where: { dmPairKey },
    select: dmSelect,
  });
  if (!conv) {
    try {
      conv = await prisma.conversation.create({
        data: {
          type: "DM",
          dmPairKey,
          memberCap: 2,
        },
        select: dmSelect,
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        conv = await prisma.conversation.findUniqueOrThrow({
          where: { dmPairKey },
          select: dmSelect,
        });
      } else {
        throw err;
      }
    }
  }

  const [selfMember, peerMember] = await Promise.all([
    prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: conv.id, userId },
      },
      update: { leftAt: null },
      create: { conversationId: conv.id, userId, role: "MEMBER" },
      select: { muted: true, lastReadAt: true },
    }),
    prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: conv.id, userId: peerId },
      },
      update: { leftAt: null },
      create: { conversationId: conv.id, userId: peerId, role: "MEMBER" },
      select: {
        lastReadAt: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            showOnlineStatus: true,
            lastActiveAt: true,
          },
        },
      },
    }),
  ]);

  return {
    id: conv.id,
    type: "DM",
    name: peerMember.user.name,
    emoji: conv.emoji,
    accentColor: conv.accentColor,
    ownerId: conv.ownerId,
    membersCanInvite: conv.membersCanInvite,
    memberCount: 2,
    muted: selfMember.muted,
    lastReadAt: selfMember.lastReadAt.toISOString(),
    lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
    unreadCount: 0,
    peer: {
      id: peerMember.user.id,
      name: peerMember.user.name,
      image: peerMember.user.image,
      isOnline: computeOnline(
        peerMember.user.showOnlineStatus,
        peerMember.user.lastActiveAt,
      ),
      lastReadAt: peerMember.lastReadAt.toISOString(),
    },
    lastMessage: null,
  };
}

export async function getConversationMessages(params: {
  userId: string;
  conversationId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<{
  messages: ChatMessageDTO[];
  nextCursor: string | null;
  hasMore: boolean;
  peerLastReadAt: string | null;
}> {
  const access = await canUserAccessConversation(
    params.userId,
    params.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Conversation not found", 404, "NOT_FOUND");
  }

  if (access.conversationType === "PUBLIC" && !access.hasMembership) {
    await ensurePublicConversationMember(params.userId);
  }

  loadKeyringFromEnv();

  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
  );
  const cursorObj = params.cursor ? decodeCursor(params.cursor) : null;

  const where: Prisma.MessageWhereInput = {
    conversationId: params.conversationId,
    ...(cursorObj
      ? {
          OR: [
            { createdAt: { lt: cursorObj.createdAt } },
            {
              createdAt: cursorObj.createdAt,
              id: { lt: cursorObj.id },
            },
          ],
        }
      : {}),
  };

  const [rows, peerMember] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: messageInclude,
    }),
    access.conversationType === "DM"
      ? prisma.conversationMember.findFirst({
          where: {
            conversationId: params.conversationId,
            userId: { not: params.userId },
            leftAt: null,
          },
          select: { lastReadAt: true },
        })
      : Promise.resolve(null),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return {
    messages: pageRows.map(serializeMessage),
    nextCursor: hasMore && lastRow ? encodeCursor(lastRow.createdAt, lastRow.id) : null,
    hasMore,
    peerLastReadAt: peerMember ? peerMember.lastReadAt.toISOString() : null,
  };
}

export async function getConversationMessageById(params: {
  userId: string;
  messageId: string;
}): Promise<ChatMessageDTO> {
  const row = await prisma.message.findUnique({
    where: { id: params.messageId },
    include: {
      ...messageInclude,
      conversation: {
        select: {
          type: true,
          dmPairKey: true,
          members: {
            where: { userId: params.userId, leftAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!row) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  const conv = row.conversation;
  if (conv.type !== "PUBLIC") {
    if (conv.members.length === 0) {
      throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
    }
    if (conv.type === "DM") {
      if (!conv.dmPairKey) {
        throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
      }
      const [idA, idB] = conv.dmPairKey.split(":");
      const peerId = idA === params.userId ? idB : idA;
      if (!peerId) {
        throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
      }
      const pairKey = canonicalPairKey(params.userId, peerId);
      const [friendship, block] = await Promise.all([
        prisma.friendship.findUnique({
          where: { pairKey },
          select: { status: true },
        }),
        prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: params.userId, blockedId: peerId },
              { blockerId: peerId, blockedId: params.userId },
            ],
          },
          select: { id: true },
        }),
      ]);
      if (block || friendship?.status !== "ACCEPTED") {
        throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
      }
    }
  }

  loadKeyringFromEnv();
  return serializeMessage(row);
}

export async function sendMessage(params: {
  userId: string;
  conversationId: string;
  body: string;
  clientId?: string | null;
  replyToId?: string | null;
  publicTimeoutUntil?: Date | null;
}): Promise<{ message: ChatMessageDTO; deduplicated: boolean }> {
  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new ChatServiceError("Message cannot be empty", 400, "EMPTY_MESSAGE");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ChatServiceError(
      `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      400,
      "MESSAGE_TOO_LONG",
    );
  }

  const clientId = params.clientId?.trim() ? params.clientId.trim().slice(0, 100) : null;

  const access = await canUserAccessConversation(
    params.userId,
    params.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Conversation not found", 404, "NOT_FOUND");
  }

  if (access.conversationType === "PUBLIC") {
    if (
      params.publicTimeoutUntil &&
      params.publicTimeoutUntil.getTime() > Date.now()
    ) {
      throw new ChatServiceError(
        "You are temporarily timed out from the public space",
        403,
        "PUBLIC_TIMEOUT",
      );
    }
    if (!access.hasMembership) {
      await ensurePublicConversationMember(params.userId);
    }
  }

  loadKeyringFromEnv();

  const [burstLimit, minuteLimit, slow, replyTarget] = await Promise.all([
    checkRateLimit(
      `chat:msg:burst:${params.userId}`,
      MESSAGE_BURST_LIMIT,
      MESSAGE_BURST_WINDOW_SECONDS,
    ),
    checkRateLimit(
      `chat:msg:min:${params.userId}`,
      MESSAGE_MINUTE_LIMIT,
      MESSAGE_MINUTE_WINDOW_SECONDS,
    ),
    access.conversationType === "PUBLIC"
      ? checkRateLimit(
          `chat:public:slow:${params.userId}`,
          1,
          PUBLIC_SLOW_MODE_SECONDS,
        )
      : Promise.resolve({ allowed: true }),
    params.replyToId
      ? prisma.message.findUnique({
          where: { id: params.replyToId },
          select: { id: true, conversationId: true, deletedAt: true },
        })
      : Promise.resolve(null),
  ]);

  if (!slow.allowed) {
    throw new ChatServiceError(
      "Slow mode active in public space. Please wait a moment.",
      429,
      "SLOW_MODE",
    );
  }
  if (!burstLimit.allowed || !minuteLimit.allowed) {
    throw new ChatServiceError(
      "Sending too quickly. Please wait before sending again.",
      429,
      "RATE_LIMITED",
    );
  }

  if (params.replyToId) {
    if (
      !replyTarget ||
      replyTarget.conversationId !== params.conversationId ||
      replyTarget.deletedAt
    ) {
      throw new ChatServiceError("Reply target not found", 400, "INVALID_REPLY");
    }
  }

  const messageId = `msg_${randomUUID().replace(/-/g, "")}`;
  const encrypted = encryptMessage({
    plaintext: trimmed,
    conversationId: params.conversationId,
    messageId,
    senderId: params.userId,
  });

  const now = new Date();
  let createdRow: MessageRow;
  try {
    const [msg] = await Promise.all([
      prisma.message.create({
        data: {
          id: messageId,
          clientId,
          conversationId: params.conversationId,
          senderId: params.userId,
          type: "TEXT",
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          keyVersion: encrypted.keyVersion,
          replyToId: params.replyToId ?? null,
          createdAt: now,
        },
        include: messageInclude,
      }),
      prisma.conversation.update({
        where: { id: params.conversationId },
        data: { lastMessageAt: now },
      }),
      prisma.conversationMember.updateMany({
        where: {
          conversationId: params.conversationId,
          userId: params.userId,
          leftAt: null,
        },
        data: { lastReadAt: now },
      }),
    ]);
    createdRow = msg;
  } catch (err) {
    if (
      clientId &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const existing = await prisma.message.findUnique({
        where: {
          conversationId_senderId_clientId: {
            conversationId: params.conversationId,
            senderId: params.userId,
            clientId,
          },
        },
        include: messageInclude,
      });
      if (existing) {
        return { message: serializeMessage(existing), deduplicated: true };
      }
    }
    throw err;
  }

  const transport = getRealtimeTransport();
  const payload = {
    type: "message.created" as const,
    conversationId: params.conversationId,
    messageId: createdRow.id,
    senderId: params.userId,
    createdAt: createdRow.createdAt.toISOString(),
  };
  await transport.publish(conversationChannel(params.conversationId), payload);
  if (access.conversationType === "DM" && access.dmPeerId) {
    await transport.publish(userChannel(access.dmPeerId), payload);
  }

  return { message: serializeMessage(createdRow), deduplicated: false };
}

export async function editMessage(params: {
  userId: string;
  messageId: string;
  body: string;
}): Promise<ChatMessageDTO> {
  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new ChatServiceError("Message cannot be empty", 400, "EMPTY_MESSAGE");
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new ChatServiceError(
      `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      400,
      "MESSAGE_TOO_LONG",
    );
  }

  const row = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      type: true,
      deletedAt: true,
      isAnonymized: true,
    },
  });

  if (!row) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  const access = await canUserAccessConversation(
    params.userId,
    row.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  if (row.senderId !== params.userId || row.isAnonymized) {
    throw new ChatServiceError(
      "You can only edit your own messages",
      403,
      "FORBIDDEN",
    );
  }

  if (row.deletedAt || row.type !== "TEXT") {
    throw new ChatServiceError(
      "This message cannot be edited",
      400,
      "NOT_EDITABLE",
    );
  }

  loadKeyringFromEnv();
  const encrypted = encryptMessage({
    plaintext: trimmed,
    conversationId: row.conversationId,
    messageId: row.id,
    senderId: params.userId,
  });

  const editedAt = new Date();
  const updated = await prisma.message.update({
    where: { id: row.id },
    data: {
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      keyVersion: encrypted.keyVersion,
      editedAt,
    },
    include: messageInclude,
  });

  await getRealtimeTransport().publish(conversationChannel(row.conversationId), {
    type: "message.updated",
    conversationId: row.conversationId,
    messageId: row.id,
    senderId: params.userId,
    editedAt: editedAt.toISOString(),
  });

  return serializeMessage(updated);
}

export async function deleteMessage(params: {
  userId: string;
  messageId: string;
}): Promise<ChatMessageDTO> {
  const row = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
      isAnonymized: true,
    },
  });

  if (!row) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  const access = await canUserAccessConversation(
    params.userId,
    row.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  if (row.senderId !== params.userId || row.isAnonymized) {
    throw new ChatServiceError(
      "You can only delete your own messages",
      403,
      "FORBIDDEN",
    );
  }

  if (row.deletedAt) {
    return getConversationMessageById({
      userId: params.userId,
      messageId: row.id,
    });
  }

  const deletedAt = new Date();
  const updated = await prisma.message.update({
    where: { id: row.id },
    data: {
      deletedAt,
      ciphertext: "",
      nonce: "",
    },
    include: messageInclude,
  });

  await getRealtimeTransport().publish(conversationChannel(row.conversationId), {
    type: "message.deleted",
    conversationId: row.conversationId,
    messageId: row.id,
    senderId: params.userId,
    deletedAt: deletedAt.toISOString(),
  });

  return serializeMessage(updated);
}

export async function markConversationRead(params: {
  userId: string;
  conversationId: string;
}): Promise<Date> {
  const access = await canUserAccessConversation(
    params.userId,
    params.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Conversation not found", 404, "NOT_FOUND");
  }

  if (access.conversationType === "PUBLIC" && !access.hasMembership) {
    await ensurePublicConversationMember(params.userId);
  }

  const lastReadAt = new Date();
  await prisma.conversationMember.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: params.userId,
      leftAt: null,
    },
    data: { lastReadAt },
  });

  const transport = getRealtimeTransport();
  await Promise.all([
    transport.publish(conversationChannel(params.conversationId), {
      type: "read",
      conversationId: params.conversationId,
      userId: params.userId,
      lastReadAt: lastReadAt.toISOString(),
    }),
    transport.publish(userChannel(params.userId), {
      type: "unread.sync",
      conversationId: params.conversationId,
    }),
  ]);

  return lastReadAt;
}

export async function setConversationMuted(params: {
  userId: string;
  conversationId: string;
  muted: boolean;
}): Promise<boolean> {
  const access = await canUserAccessConversation(
    params.userId,
    params.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Conversation not found", 404, "NOT_FOUND");
  }

  if (access.conversationType === "PUBLIC" && !access.hasMembership) {
    await ensurePublicConversationMember(params.userId);
  }

  await prisma.conversationMember.updateMany({
    where: {
      conversationId: params.conversationId,
      userId: params.userId,
      leftAt: null,
    },
    data: { muted: params.muted },
  });

  return params.muted;
}
