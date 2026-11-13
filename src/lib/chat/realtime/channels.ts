import { prisma } from "@/lib/prisma";
import { canonicalPairKey } from "@/lib/chat/friends";
import {
  conversationChannel,
  presenceChannel,
  userChannel,
} from "./types";

export interface AuthorizedChannelsResult {
  channels: string[];
  conversationIds: string[];
  showOnlineStatus: boolean;
  termsAccepted: boolean;
}

export async function ensurePublicConversationMember(userId: string): Promise<string | null> {
  const pub = await prisma.conversation.findUnique({
    where: { publicKey: "PUBLIC" },
    select: { id: true },
  });
  if (!pub) return null;

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: pub.id,
        userId,
      },
    },
    update: { leftAt: null },
    create: {
      conversationId: pub.id,
      userId,
      role: "MEMBER",
    },
  });

  return pub.id;
}

export async function getAuthorizedChannelsForUser(
  userId: string,
): Promise<AuthorizedChannelsResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      showOnlineStatus: true,
      chatTermsAcceptedAt: true,
      chatBannedAt: true,
    },
  });

  if (!user || user.chatBannedAt) {
    return {
      channels: [],
      conversationIds: [],
      showOnlineStatus: false,
      termsAccepted: false,
    };
  }

  const termsAccepted = Boolean(user.chatTermsAcceptedAt);
  const channels = [userChannel(userId)];
  const conversationIds: string[] = [];

  if (!termsAccepted) {
    return {
      channels,
      conversationIds,
      showOnlineStatus: user.showOnlineStatus,
      termsAccepted: false,
    };
  }

  await ensurePublicConversationMember(userId);
  channels.push(presenceChannel());

  const [memberships, blocks, friendships] = await Promise.all([
    prisma.conversationMember.findMany({
      where: { userId, leftAt: null },
      select: {
        conversationId: true,
        conversation: {
          select: {
            id: true,
            type: true,
            dmPairKey: true,
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

  const blockedUsers = new Set<string>();
  for (const b of blocks) {
    blockedUsers.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  const acceptedPairs = new Set(friendships.map((f) => f.pairKey));

  for (const m of memberships) {
    const conv = m.conversation;
    if (conv.type === "DM") {
      if (!conv.dmPairKey || !acceptedPairs.has(conv.dmPairKey)) continue;
      const [idA, idB] = conv.dmPairKey.split(":");
      const peerId = idA === userId ? idB : idA;
      if (!peerId || blockedUsers.has(peerId)) continue;
    }
    conversationIds.push(conv.id);
    channels.push(conversationChannel(conv.id));
  }

  return {
    channels,
    conversationIds,
    showOnlineStatus: user.showOnlineStatus,
    termsAccepted: true,
  };
}

export async function canUserAccessConversation(
  userId: string,
  conversationId: string,
): Promise<{ ok: boolean; conversationType?: "PUBLIC" | "DM" | "ROOM" }> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      type: true,
      dmPairKey: true,
      members: {
        where: { userId, leftAt: null },
        select: { id: true },
      },
    },
  });

  if (!conv) return { ok: false };

  if (conv.type === "PUBLIC") {
    return { ok: true, conversationType: "PUBLIC" };
  }

  if (conv.members.length === 0) {
    return { ok: false };
  }

  if (conv.type === "DM") {
    if (!conv.dmPairKey) return { ok: false };
    const [idA, idB] = conv.dmPairKey.split(":");
    const peerId = idA === userId ? idB : idA;
    if (!peerId) return { ok: false };
    const pairKey = canonicalPairKey(userId, peerId);
    const [friendship, block] = await Promise.all([
      prisma.friendship.findUnique({
        where: { pairKey },
        select: { status: true },
      }),
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedId: peerId },
            { blockerId: peerId, blockedId: userId },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (block || friendship?.status !== "ACCEPTED") {
      return { ok: false };
    }
  }

  return { ok: true, conversationType: conv.type };
}
