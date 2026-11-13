import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptMessage, loadKeyringFromEnv } from "./crypto-core";
import {
  areFriends,
  assertFriendsAndUnblocked,
  canonicalPairKey,
  ChatServiceError,
  ONLINE_WINDOW_MS,
} from "./friends";
import { getRealtimeTransport } from "./realtime";
import { canUserAccessConversation } from "./realtime/channels";
import { conversationChannel, userChannel } from "./realtime/types";

export const ROOM_ACCENT_TOKENS = ["main", "brass", "gold", "sage"] as const;
export type RoomAccentToken = (typeof ROOM_ACCENT_TOKENS)[number];

export const DEFAULT_ROOM_MEMBER_CAP = 50;
export const MAX_ROOM_MEMBER_CAP = 50;
export const DEFAULT_INVITE_EXPIRY_HOURS = 48;
export const MAX_INVITE_EXPIRY_HOURS = 168;
export const MAX_LINK_INVITE_USES = 25;

const createRoomSchema = z.object({
  name: z.string().trim().min(2).max(60),
  emoji: z.string().trim().min(1).max(12).optional().nullable(),
  accentColor: z.enum(ROOM_ACCENT_TOKENS).optional().nullable(),
  memberCap: z.number().int().min(2).max(MAX_ROOM_MEMBER_CAP).optional(),
  membersCanInvite: z.boolean().optional(),
  inviteFriendIds: z.array(z.string().min(1).max(64)).max(10).optional(),
});

const updateRoomSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  emoji: z.string().trim().min(1).max(12).optional().nullable(),
  accentColor: z.enum(ROOM_ACCENT_TOKENS).optional().nullable(),
  memberCap: z.number().int().min(2).max(MAX_ROOM_MEMBER_CAP).optional(),
  membersCanInvite: z.boolean().optional(),
});

const createInviteSchema = z.object({
  kind: z.enum(["MESSAGE", "LINK"]),
  inviteeId: z.string().min(1).max(64).optional().nullable(),
  expiresInHours: z.number().int().min(1).max(MAX_INVITE_EXPIRY_HOURS).optional(),
  maxUses: z.number().int().min(1).max(MAX_LINK_INVITE_USES).optional(),
});

export interface RoomMemberDTO {
  id: string;
  userId: string;
  name: string | null;
  image: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: string;
  isOnline: boolean | null;
}

export interface RoomInviteSummaryDTO {
  id: string;
  kind: "LINK" | "MESSAGE";
  inviterId: string;
  inviteeId: string | null;
  inviteeName: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "REVOKED" | "EXPIRED";
  uses: number;
  maxUses: number;
  expiresAt: string;
  createdAt: string;
}

export interface RoomDetailsDTO {
  id: string;
  name: string;
  emoji: string | null;
  accentColor: string | null;
  ownerId: string | null;
  membersCanInvite: boolean;
  memberCap: number;
  memberCount: number;
  myRole: "OWNER" | "MEMBER";
  members: RoomMemberDTO[];
  invites: RoomInviteSummaryDTO[];
}

export interface LinkInvitePreviewDTO {
  inviteId: string;
  roomId: string;
  roomName: string;
  roomEmoji: string | null;
  roomAccentColor: string | null;
  inviterId: string;
  inviterName: string | null;
  inviterImage: string | null;
  expiresAt: string;
  alreadyMember: boolean;
}

function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function constantTimeHexMatch(aHex: string, bHex: string): boolean {
  if (aHex.length !== 64 || bHex.length !== 64) {
    const zero = Buffer.alloc(32);
    timingSafeEqual(zero, zero);
    return false;
  }
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== 32 || b.length !== 32) {
    const zero = Buffer.alloc(32);
    timingSafeEqual(zero, zero);
    return false;
  }
  return timingSafeEqual(a, b);
}

function computeOnline(
  showOnlineStatus: boolean | null | undefined,
  lastActiveAt: Date | null | undefined,
): boolean | null {
  if (!showOnlineStatus) return null;
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() <= ONLINE_WINDOW_MS;
}

async function assertNotBlockedWithAny(
  userId: string,
  otherIds: Array<string | null | undefined>,
): Promise<boolean> {
  const targets = Array.from(
    new Set(otherIds.filter((id): id is string => Boolean(id) && id !== userId)),
  );
  if (targets.length === 0) return false;
  const count = await prisma.block.count({
    where: {
      OR: [
        { blockerId: userId, blockedId: { in: targets } },
        { blockerId: { in: targets }, blockedId: userId },
      ],
    },
  });
  return count > 0;
}

async function assertCanInviteToRoom(inviterId: string, roomId: string) {
  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      type: true,
      name: true,
      emoji: true,
      accentColor: true,
      ownerId: true,
      membersCanInvite: true,
      memberCap: true,
      members: {
        where: { leftAt: null },
        select: { userId: true, role: true },
      },
    },
  });

  if (!room || room.type !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const membership = room.members.find((m) => m.userId === inviterId);
  if (!membership) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  if (room.ownerId !== inviterId && !room.membersCanInvite) {
    throw new ChatServiceError(
      "Only the room owner can send invites",
      403,
      "INVITES_DISABLED",
    );
  }

  if (room.members.length >= room.memberCap) {
    throw new ChatServiceError("Room is at capacity", 400, "ROOM_FULL");
  }

  return room;
}

export async function createRoom(
  ownerId: string,
  rawInput: z.input<typeof createRoomSchema>,
) {
  const parsed = createRoomSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ChatServiceError("Invalid room details", 400, "INVALID_INPUT");
  }

  const rl = await checkRateLimit(`chat:room-create:${ownerId}`, 10, 3600);
  if (!rl.allowed) {
    throw new ChatServiceError("Too many rooms created recently", 429, "RATE_LIMITED");
  }

  const data = parsed.data;
  const memberCap = data.memberCap ?? DEFAULT_ROOM_MEMBER_CAP;
  const membersCanInvite = data.membersCanInvite ?? true;

  const room = await prisma.conversation.create({
    data: {
      type: "ROOM",
      name: data.name,
      emoji: data.emoji ?? null,
      accentColor: data.accentColor ?? "main",
      ownerId,
      membersCanInvite,
      memberCap,
      lastMessageAt: new Date(),
      members: {
        create: {
          userId: ownerId,
          role: "OWNER",
          lastReadAt: new Date(),
        },
      },
    },
    select: {
      id: true,
      type: true,
      name: true,
      emoji: true,
      accentColor: true,
      ownerId: true,
      membersCanInvite: true,
      memberCap: true,
      createdAt: true,
    },
  });

  const invitedIds: string[] = [];
  if (data.inviteFriendIds && data.inviteFriendIds.length > 0) {
    const uniqueFriends = Array.from(
      new Set(data.inviteFriendIds.filter((id) => id !== ownerId)),
    ).slice(0, 10);
    for (const friendId of uniqueFriends) {
      try {
        await createMessageInvite(ownerId, {
          roomId: room.id,
          inviteeId: friendId,
        });
        invitedIds.push(friendId);
      } catch {
        // Skip invalid/non-friend selections while preserving room creation.
      }
    }
  }

  const transport = getRealtimeTransport();
  await transport.publish(userChannel(ownerId), {
    type: "member.changed",
    conversationId: room.id,
    action: "joined",
    userId: ownerId,
  });

  return {
    id: room.id,
    name: room.name ?? data.name,
    emoji: room.emoji,
    accentColor: room.accentColor,
    ownerId: room.ownerId,
    membersCanInvite: room.membersCanInvite,
    memberCap: room.memberCap,
    invitedIds,
  };
}

export async function getRoomDetails(
  userId: string,
  roomId: string,
): Promise<RoomDetailsDTO> {
  const access = await canUserAccessConversation(userId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const [room, members, myMembership, invites] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        emoji: true,
        accentColor: true,
        ownerId: true,
        membersCanInvite: true,
        memberCap: true,
      },
    }),
    prisma.conversationMember.findMany({
      where: { conversationId: roomId, leftAt: null },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            name: true,
            image: true,
            showOnlineStatus: true,
            lastActiveAt: true,
          },
        },
      },
    }),
    prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: roomId, userId },
      },
      select: { role: true },
    }),
    prisma.invite.findMany({
      where: {
        roomId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        inviterId: true,
        inviteeId: true,
        status: true,
        uses: true,
        maxUses: true,
        expiresAt: true,
        createdAt: true,
        invitee: { select: { name: true } },
      },
    }),
  ]);

  if (!room || !myMembership) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const isOwner = room.ownerId === userId;
  const visibleInvites = isOwner
    ? invites
    : invites.filter((inv) => inv.inviterId === userId);

  return {
    id: room.id,
    name: room.name ?? "",
    emoji: room.emoji,
    accentColor: room.accentColor,
    ownerId: room.ownerId,
    membersCanInvite: room.membersCanInvite,
    memberCap: room.memberCap,
    memberCount: members.length,
    myRole: myMembership.role,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      image: m.user.image,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      isOnline: computeOnline(m.user.showOnlineStatus, m.user.lastActiveAt),
    })),
    invites: visibleInvites.map((inv) => ({
      id: inv.id,
      kind: inv.kind,
      inviterId: inv.inviterId,
      inviteeId: inv.inviteeId,
      inviteeName: inv.invitee?.name ?? null,
      status: inv.status,
      uses: inv.uses,
      maxUses: inv.maxUses,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    })),
  };
}

export async function updateRoomSettings(
  ownerId: string,
  roomId: string,
  rawInput: z.input<typeof updateRoomSchema>,
) {
  const parsed = updateRoomSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ChatServiceError("Invalid room settings", 400, "INVALID_INPUT");
  }

  const access = await canUserAccessConversation(ownerId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }
  if (room.ownerId !== ownerId) {
    throw new ChatServiceError("Only the owner can update room settings", 403, "FORBIDDEN");
  }

  const updates = parsed.data;
  if (updates.memberCap !== undefined) {
    const activeCount = await prisma.conversationMember.count({
      where: { conversationId: roomId, leftAt: null },
    });
    if (updates.memberCap < activeCount) {
      throw new ChatServiceError(
        "Member cap cannot be below current member count",
        400,
        "CAP_TOO_LOW",
      );
    }
  }

  const updated = await prisma.conversation.update({
    where: { id: roomId },
    data: {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.emoji !== undefined ? { emoji: updates.emoji } : {}),
      ...(updates.accentColor !== undefined
        ? { accentColor: updates.accentColor }
        : {}),
      ...(updates.memberCap !== undefined
        ? { memberCap: updates.memberCap }
        : {}),
      ...(updates.membersCanInvite !== undefined
        ? { membersCanInvite: updates.membersCanInvite }
        : {}),
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      accentColor: true,
      ownerId: true,
      membersCanInvite: true,
      memberCap: true,
    },
  });

  const transport = getRealtimeTransport();
  await transport.publish(conversationChannel(roomId), {
    type: "member.changed",
    conversationId: roomId,
    action: "updated",
    userId: ownerId,
  });

  return updated;
}

export async function removeRoomMember(
  ownerId: string,
  roomId: string,
  targetUserId: string,
): Promise<void> {
  const access = await canUserAccessConversation(ownerId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }
  if (room.ownerId !== ownerId) {
    throw new ChatServiceError("Only the owner can remove members", 403, "FORBIDDEN");
  }
  if (targetUserId === ownerId) {
    throw new ChatServiceError("Owner cannot remove self; leave or transfer ownership", 400, "CANNOT_REMOVE_SELF");
  }

  const result = await prisma.conversationMember.updateMany({
    where: { conversationId: roomId, userId: targetUserId, leftAt: null },
    data: { leftAt: new Date() },
  });

  if (result.count === 0) {
    throw new ChatServiceError("Member not found in room", 404, "NOT_FOUND");
  }

  const transport = getRealtimeTransport();
  await Promise.all([
    transport.publish(conversationChannel(roomId), {
      type: "member.changed",
      conversationId: roomId,
      action: "removed",
      userId: targetUserId,
    }),
    transport.publish(userChannel(targetUserId), {
      type: "member.changed",
      conversationId: roomId,
      action: "removed",
      userId: targetUserId,
    }),
    transport.publish(userChannel(targetUserId), {
      type: "unread.sync",
      conversationId: roomId,
    }),
  ]);
}

export async function transferRoomOwnership(
  ownerId: string,
  roomId: string,
  newOwnerId: string,
): Promise<void> {
  const access = await canUserAccessConversation(ownerId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }
  if (room.ownerId !== ownerId) {
    throw new ChatServiceError("Only the owner can transfer ownership", 403, "FORBIDDEN");
  }
  if (newOwnerId === ownerId) {
    throw new ChatServiceError("Already the room owner", 400, "INVALID_INPUT");
  }

  const targetMembership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: roomId, userId: newOwnerId },
    },
    select: { id: true, leftAt: true },
  });
  if (!targetMembership || targetMembership.leftAt) {
    throw new ChatServiceError("Target user is not an active member", 400, "NOT_A_MEMBER");
  }

  await prisma.$transaction([
    prisma.conversation.update({
      where: { id: roomId },
      data: { ownerId: newOwnerId },
    }),
    prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: roomId, userId: ownerId },
      },
      data: { role: "MEMBER" },
    }),
    prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: roomId, userId: newOwnerId },
      },
      data: { role: "OWNER" },
    }),
  ]);

  const transport = getRealtimeTransport();
  await transport.publish(conversationChannel(roomId), {
    type: "member.changed",
    conversationId: roomId,
    action: "updated",
    userId: newOwnerId,
  });
}

export async function leaveRoom(userId: string, roomId: string): Promise<{ deleted: boolean }> {
  const access = await canUserAccessConversation(userId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  if (room.ownerId === userId) {
    const otherActive = await prisma.conversationMember.count({
      where: { conversationId: roomId, userId: { not: userId }, leftAt: null },
    });
    if (otherActive > 0) {
      throw new ChatServiceError(
        "Transfer ownership or delete the room before leaving",
        400,
        "OWNER_MUST_TRANSFER",
      );
    }
    await prisma.conversation.delete({ where: { id: roomId } });
    const transport = getRealtimeTransport();
    await transport.publish(userChannel(userId), {
      type: "member.changed",
      conversationId: roomId,
      action: "left",
      userId,
    });
    return { deleted: true };
  }

  await prisma.conversationMember.updateMany({
    where: { conversationId: roomId, userId, leftAt: null },
    data: { leftAt: new Date() },
  });

  const transport = getRealtimeTransport();
  await Promise.all([
    transport.publish(conversationChannel(roomId), {
      type: "member.changed",
      conversationId: roomId,
      action: "left",
      userId,
    }),
    transport.publish(userChannel(userId), {
      type: "member.changed",
      conversationId: roomId,
      action: "left",
      userId,
    }),
    transport.publish(userChannel(userId), {
      type: "unread.sync",
      conversationId: roomId,
    }),
  ]);

  return { deleted: false };
}

export async function deleteRoom(ownerId: string, roomId: string): Promise<void> {
  const access = await canUserAccessConversation(ownerId, roomId);
  if (!access.ok || access.conversationType !== "ROOM") {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }

  const room = await prisma.conversation.findUnique({
    where: { id: roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) {
    throw new ChatServiceError("Room not found", 404, "NOT_FOUND");
  }
  if (room.ownerId !== ownerId) {
    throw new ChatServiceError("Only the owner can delete the room", 403, "FORBIDDEN");
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: roomId, leftAt: null },
    select: { userId: true },
  });

  await prisma.conversation.delete({ where: { id: roomId } });

  const transport = getRealtimeTransport();
  await Promise.all(
    members.flatMap((m) => [
      transport.publish(userChannel(m.userId), {
        type: "member.changed",
        conversationId: roomId,
        action: "removed",
        userId: m.userId,
      }),
      transport.publish(userChannel(m.userId), {
        type: "unread.sync",
        conversationId: roomId,
      }),
    ]),
  );
}

export async function createMessageInvite(
  inviterId: string,
  input: { roomId: string; inviteeId: string; expiresInHours?: number },
) {
  const rl = await checkRateLimit(`chat:invite-create:${inviterId}`, 30, 3600);
  if (!rl.allowed) {
    throw new ChatServiceError("Invite rate limit reached", 429, "RATE_LIMITED");
  }

  const room = await assertCanInviteToRoom(inviterId, input.roomId);
  if (room.members.some((m) => m.userId === input.inviteeId)) {
    throw new ChatServiceError("User is already a member", 409, "ALREADY_MEMBER");
  }
  await Promise.all([
    assertFriendsAndUnblocked(inviterId, input.inviteeId),
    assertNotBlockedWithAny(input.inviteeId, [room.ownerId]).then((blocked) => {
      if (blocked) throw new ChatServiceError("Blocked", 403, "BLOCKED");
    }),
  ]);

  const dmPairKey = canonicalPairKey(inviterId, input.inviteeId);
  const now = new Date();
  const dm = await prisma.conversation.upsert({
    where: { dmPairKey },
    update: {},
    create: { type: "DM", dmPairKey, memberCap: 2 },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: dm.id, userId: inviterId },
      },
      update: { leftAt: null },
      create: {
        conversationId: dm.id,
        userId: inviterId,
        role: "MEMBER",
        lastReadAt: now,
      },
    }),
    prisma.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId: dm.id,
          userId: input.inviteeId,
        },
      },
      update: { leftAt: null },
      create: {
        conversationId: dm.id,
        userId: input.inviteeId,
        role: "MEMBER",
        lastReadAt: new Date(0),
      },
    }),
  ]);

  const hours = Math.min(
    Math.max(input.expiresInHours ?? DEFAULT_INVITE_EXPIRY_HOURS, 1),
    MAX_INVITE_EXPIRY_HOURS,
  );
  const expiresAt = new Date(Date.now() + hours * 3_600_000);
  const messageId = randomUUID();
  const keyring = loadKeyringFromEnv();
  const encrypted = encryptMessage(
    {
      conversationId: dm.id,
      messageId,
      senderId: inviterId,
      plaintext: room.name ?? "Room invite",
    },
    keyring,
  );

  const [, invite] = await prisma.$transaction([
    prisma.message.create({
      data: {
        id: messageId,
        conversationId: dm.id,
        senderId: inviterId,
        type: "ROOM_INVITE",
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        keyVersion: encrypted.keyVersion,
        createdAt: now,
      },
    }),
    prisma.invite.create({
      data: {
        roomId: room.id,
        inviterId,
        inviteeId: input.inviteeId,
        kind: "MESSAGE",
        messageId,
        expiresAt,
        maxUses: 1,
        status: "PENDING",
      },
      select: {
        id: true,
        roomId: true,
        inviterId: true,
        inviteeId: true,
        kind: true,
        status: true,
        expiresAt: true,
        messageId: true,
      },
    }),
    prisma.conversation.update({
      where: { id: dm.id },
      data: { lastMessageAt: now },
    }),
    prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: dm.id, userId: inviterId },
      },
      data: { lastReadAt: now },
    }),
  ]);

  const transport = getRealtimeTransport();
  await Promise.all([
    transport.publish(conversationChannel(dm.id), {
      type: "message.created",
      conversationId: dm.id,
      messageId,
      senderId: inviterId,
      createdAt: now.toISOString(),
    }),
    transport.publish(userChannel(input.inviteeId), {
      type: "invite.received",
      inviteId: invite.id,
      conversationId: dm.id,
      inviterId,
    }),
    transport.publish(userChannel(input.inviteeId), {
      type: "unread.sync",
      conversationId: dm.id,
    }),
  ]);

  return {
    invite: {
      id: invite.id,
      roomId: invite.roomId,
      inviterId: invite.inviterId,
      inviteeId: invite.inviteeId,
      kind: invite.kind,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      messageId: invite.messageId,
    },
    dmConversationId: dm.id,
  };
}

export async function respondToMessageInvite(
  actorId: string,
  inviteId: string,
  decision: "accept" | "decline",
) {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      kind: true,
      roomId: true,
      inviterId: true,
      inviteeId: true,
      status: true,
      uses: true,
      maxUses: true,
      expiresAt: true,
      message: { select: { conversationId: true } },
      room: { select: { id: true, ownerId: true, memberCap: true } },
    },
  });

  if (!invite || invite.kind !== "MESSAGE") {
    throw new ChatServiceError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.inviteeId !== actorId) {
    if (invite.inviterId === actorId) {
      throw new ChatServiceError("Only the invitee can respond", 403, "FORBIDDEN");
    }
    throw new ChatServiceError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.status !== "PENDING") {
    throw new ChatServiceError("Invite is no longer active", 409, "INVITE_INACTIVE");
  }

  const now = new Date();
  if (invite.expiresAt <= now) {
    await prisma.invite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (invite.message?.conversationId) {
      await getRealtimeTransport().publish(
        conversationChannel(invite.message.conversationId),
        {
          type: "invite.updated",
          inviteId: invite.id,
          conversationId: invite.message.conversationId,
          status: "EXPIRED",
        },
      );
    }
    throw new ChatServiceError("Invite has expired", 410, "INVITE_EXPIRED");
  }

  const transport = getRealtimeTransport();
  const dmId = invite.message?.conversationId;

  if (decision === "decline") {
    const updated = await prisma.invite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "DECLINED" },
    });
    if (updated.count === 0) {
      throw new ChatServiceError("Invite is no longer active", 409, "INVITE_INACTIVE");
    }
    await Promise.all([
      dmId
        ? transport.publish(conversationChannel(dmId), {
            type: "invite.updated",
            inviteId: invite.id,
            conversationId: dmId,
            status: "DECLINED",
          })
        : Promise.resolve(),
      transport.publish(userChannel(invite.inviterId), {
        type: "unread.sync",
        conversationId: dmId,
      }),
    ]);
    return { status: "DECLINED" as const, roomId: null };
  }

  const [inviterMembership, blocked, activeCount] = await Promise.all([
    prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: invite.roomId,
          userId: invite.inviterId,
        },
      },
      select: { leftAt: true },
    }),
    assertNotBlockedWithAny(actorId, [invite.inviterId, invite.room.ownerId]),
    prisma.conversationMember.count({
      where: { conversationId: invite.roomId, leftAt: null },
    }),
  ]);
  if (!inviterMembership || inviterMembership.leftAt) {
    throw new ChatServiceError("Invite is no longer valid", 409, "INVITE_INVALID");
  }
  if (blocked) {
    throw new ChatServiceError("Blocked", 403, "BLOCKED");
  }
  if (activeCount >= invite.room.memberCap) {
    throw new ChatServiceError("Room is at capacity", 409, "ROOM_FULL");
  }

  const claimed = await prisma.invite.updateMany({
    where: {
      id: invite.id,
      status: "PENDING",
      uses: { lt: invite.maxUses },
      expiresAt: { gt: now },
    },
    data: {
      uses: { increment: 1 },
      status: "ACCEPTED",
    },
  });
  if (claimed.count === 0) {
    throw new ChatServiceError("Invite is no longer active", 409, "INVITE_INACTIVE");
  }

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: invite.roomId,
        userId: actorId,
      },
    },
    update: {
      role: "MEMBER",
      leftAt: null,
      joinedAt: now,
      lastReadAt: now,
    },
    create: {
      conversationId: invite.roomId,
      userId: actorId,
      role: "MEMBER",
      joinedAt: now,
      lastReadAt: now,
    },
  });

  await Promise.all([
    transport.publish(conversationChannel(invite.roomId), {
      type: "member.changed",
      conversationId: invite.roomId,
      action: "joined",
      userId: actorId,
    }),
    transport.publish(userChannel(actorId), {
      type: "member.changed",
      conversationId: invite.roomId,
      action: "joined",
      userId: actorId,
    }),
    transport.publish(userChannel(actorId), {
      type: "unread.sync",
      conversationId: invite.roomId,
    }),
    dmId
      ? transport.publish(conversationChannel(dmId), {
          type: "invite.updated",
          inviteId: invite.id,
          conversationId: dmId,
          status: "ACCEPTED",
        })
      : Promise.resolve(),
  ]);

  return { status: "ACCEPTED" as const, roomId: invite.roomId };
}

export async function createLinkInvite(
  inviterId: string,
  input: {
    roomId: string;
    inviteeId?: string | null;
    expiresInHours?: number;
    maxUses?: number;
  },
) {
  const rl = await checkRateLimit(`chat:invite-create:${inviterId}`, 30, 3600);
  if (!rl.allowed) {
    throw new ChatServiceError("Invite rate limit reached", 429, "RATE_LIMITED");
  }

  const room = await assertCanInviteToRoom(inviterId, input.roomId);
  const inviteeId = input.inviteeId ?? null;

  if (inviteeId) {
    if (room.members.some((m) => m.userId === inviteeId)) {
      throw new ChatServiceError("User is already a member", 409, "ALREADY_MEMBER");
    }
    await Promise.all([
      assertFriendsAndUnblocked(inviterId, inviteeId),
      assertNotBlockedWithAny(inviteeId, [room.ownerId]).then((blocked) => {
        if (blocked) throw new ChatServiceError("Blocked", 403, "BLOCKED");
      }),
    ]);
  }

  const hours = Math.min(
    Math.max(input.expiresInHours ?? DEFAULT_INVITE_EXPIRY_HOURS, 1),
    MAX_INVITE_EXPIRY_HOURS,
  );
  const maxUses = inviteeId
    ? 1
    : Math.min(Math.max(input.maxUses ?? 1, 1), MAX_LINK_INVITE_USES);
  const expiresAt = new Date(Date.now() + hours * 3_600_000);

  const token = randomBytes(16).toString("base64url");
  const tokenHash = hashInviteToken(token);

  const invite = await prisma.invite.create({
    data: {
      roomId: room.id,
      inviterId,
      inviteeId,
      kind: "LINK",
      tokenHash,
      expiresAt,
      maxUses,
      status: "PENDING",
    },
    select: {
      id: true,
      roomId: true,
      inviteeId: true,
      maxUses: true,
      expiresAt: true,
    },
  });

  return {
    inviteId: invite.id,
    roomId: invite.roomId,
    inviteeId: invite.inviteeId,
    maxUses: invite.maxUses,
    expiresAt: invite.expiresAt.toISOString(),
    token,
  };
}

export async function createRoomInvite(
  inviterId: string,
  roomId: string,
  rawInput: z.input<typeof createInviteSchema>,
) {
  const parsed = createInviteSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ChatServiceError("Invalid invite request", 400, "INVALID_INPUT");
  }

  if (parsed.data.kind === "MESSAGE") {
    if (!parsed.data.inviteeId) {
      throw new ChatServiceError(
        "A friend must be selected for a message invite",
        400,
        "INVALID_INPUT",
      );
    }
    return createMessageInvite(inviterId, {
      roomId,
      inviteeId: parsed.data.inviteeId,
      expiresInHours: parsed.data.expiresInHours,
    });
  }

  return createLinkInvite(inviterId, {
    roomId,
    inviteeId: parsed.data.inviteeId,
    expiresInHours: parsed.data.expiresInHours,
    maxUses: parsed.data.maxUses,
  });
}

export async function revokeInvite(actorId: string, inviteId: string): Promise<void> {
  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      inviterId: true,
      status: true,
      room: { select: { ownerId: true } },
      message: { select: { conversationId: true } },
    },
  });

  if (!invite) {
    throw new ChatServiceError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.inviterId !== actorId && invite.room.ownerId !== actorId) {
    throw new ChatServiceError("Invite not found", 404, "NOT_FOUND");
  }

  if (invite.status !== "PENDING") {
    return;
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" },
  });

  if (invite.message?.conversationId) {
    await getRealtimeTransport().publish(
      conversationChannel(invite.message.conversationId),
      {
        type: "invite.updated",
        inviteId: invite.id,
        conversationId: invite.message.conversationId,
        status: "REVOKED",
      },
    );
  }
}

async function resolveAuthorizedLinkInvite(actorId: string, rawToken: string) {
  const rl = await checkRateLimit(`chat:invite-attempt:${actorId}`, 30, 300);
  if (!rl.allowed) {
    throw new ChatServiceError(
      "Too many invite attempts. Please wait a moment.",
      429,
      "RATE_LIMITED",
    );
  }

  const trimmed = typeof rawToken === "string" ? rawToken.trim() : "";
  if (trimmed.length < 16 || trimmed.length > 128) {
    constantTimeHexMatch("", "");
    throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
  }

  const candidateHash = hashInviteToken(trimmed);
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: candidateHash },
    select: {
      id: true,
      kind: true,
      roomId: true,
      inviterId: true,
      inviteeId: true,
      tokenHash: true,
      status: true,
      uses: true,
      maxUses: true,
      expiresAt: true,
      room: {
        select: {
          id: true,
          type: true,
          name: true,
          emoji: true,
          accentColor: true,
          ownerId: true,
          memberCap: true,
          members: {
            where: { leftAt: null },
            select: { userId: true },
          },
        },
      },
      inviter: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  const storedHash = invite?.tokenHash ?? "0".repeat(64);
  const matched = constantTimeHexMatch(candidateHash, storedHash);
  const now = new Date();

  if (
    !matched ||
    !invite ||
    invite.kind !== "LINK" ||
    invite.room.type !== "ROOM" ||
    invite.status !== "PENDING" ||
    invite.expiresAt <= now ||
    invite.uses >= invite.maxUses
  ) {
    throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
  }

  const inviterActive = invite.room.members.some(
    (m) => m.userId === invite.inviterId,
  );
  if (!inviterActive) {
    throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
  }

  // Friend-only enforcement: even a leaked link cannot be opened by strangers or blocked users.
  const alreadyMember = invite.room.members.some((m) => m.userId === actorId);

  if (!alreadyMember) {
    if (invite.inviteeId && invite.inviteeId !== actorId) {
      throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
    }

    const [friendOk, blocked] = await Promise.all([
      invite.inviteeId ? Promise.resolve(true) : areFriends(actorId, invite.inviterId),
      assertNotBlockedWithAny(actorId, [invite.inviterId, invite.room.ownerId]),
    ]);

    if (!friendOk || blocked) {
      throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
    }
  }

  return {
    invite,
    alreadyMember,
    activeMemberCount: invite.room.members.length,
  };
}

export async function inspectLinkInvite(
  actorId: string,
  rawToken: string,
): Promise<LinkInvitePreviewDTO> {
  const { invite, alreadyMember } = await resolveAuthorizedLinkInvite(
    actorId,
    rawToken,
  );

  return {
    inviteId: invite.id,
    roomId: invite.room.id,
    roomName: invite.room.name ?? "",
    roomEmoji: invite.room.emoji,
    roomAccentColor: invite.room.accentColor,
    inviterId: invite.inviter.id,
    inviterName: invite.inviter.name,
    inviterImage: invite.inviter.image,
    expiresAt: invite.expiresAt.toISOString(),
    alreadyMember,
  };
}

export async function respondToLinkInvite(
  actorId: string,
  rawToken: string,
  decision: "accept" | "decline",
) {
  const { invite, alreadyMember, activeMemberCount } =
    await resolveAuthorizedLinkInvite(actorId, rawToken);

  if (decision === "decline") {
    if (invite.inviteeId === actorId || invite.maxUses === 1) {
      await prisma.invite.updateMany({
        where: { id: invite.id, status: "PENDING" },
        data: { status: "DECLINED" },
      });
    }
    return { status: "DECLINED" as const, roomId: null };
  }

  if (alreadyMember) {
    return { status: "ALREADY_MEMBER" as const, roomId: invite.roomId };
  }

  if (activeMemberCount >= invite.room.memberCap) {
    throw new ChatServiceError("Room is at capacity", 409, "ROOM_FULL");
  }

  const now = new Date();
  const claimed = await prisma.invite.updateMany({
    where: {
      id: invite.id,
      status: "PENDING",
      uses: { lt: invite.maxUses },
      expiresAt: { gt: now },
    },
    data: { uses: { increment: 1 } },
  });

  if (claimed.count === 0) {
    throw new ChatServiceError("Invite is invalid or unavailable", 404, "INVITE_UNAVAILABLE");
  }

  await prisma.invite.updateMany({
    where: {
      id: invite.id,
      status: "PENDING",
      uses: { gte: invite.maxUses },
    },
    data: { status: "ACCEPTED" },
  });

  await prisma.conversationMember.upsert({
    where: {
      conversationId_userId: {
        conversationId: invite.roomId,
        userId: actorId,
      },
    },
    update: {
      role: "MEMBER",
      leftAt: null,
      joinedAt: now,
      lastReadAt: now,
    },
    create: {
      conversationId: invite.roomId,
      userId: actorId,
      role: "MEMBER",
      joinedAt: now,
      lastReadAt: now,
    },
  });

  const transport = getRealtimeTransport();
  await Promise.all([
    transport.publish(conversationChannel(invite.roomId), {
      type: "member.changed",
      conversationId: invite.roomId,
      action: "joined",
      userId: actorId,
    }),
    transport.publish(userChannel(actorId), {
      type: "member.changed",
      conversationId: invite.roomId,
      action: "joined",
      userId: actorId,
    }),
    transport.publish(userChannel(actorId), {
      type: "unread.sync",
      conversationId: invite.roomId,
    }),
  ]);

  return { status: "ACCEPTED" as const, roomId: invite.roomId };
}
