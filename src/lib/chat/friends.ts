import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export function canonicalPairKey(userA: string, userB: string): string {
  return userA < userB ? `${userA}:${userB}` : `${userB}:${userA}`;
}

export const ONLINE_WINDOW_MS = 5 * 60 * 1000;
export const FRIEND_REQUEST_DAILY_LIMIT = 30;
export const USER_SEARCH_PER_MIN_LIMIT = 40;

export class ChatServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
    this.code = code;
  }
}

export type RelationshipState =
  | "SELF"
  | "BLOCKED_BY_ME"
  | "BLOCKED_BY_THEM"
  | "FRIENDS"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "NONE";

export interface PublicProfileData {
  id: string;
  name: string | null;
  image: string | null;
  coverImage: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  bio: string | null;
  city: string | null;
  friendCount: number | null;
  isOnline: boolean | null;
  relationship: RelationshipState;
  canReceiveFriendRequest: boolean;
}

export interface FriendUserSummary {
  id: string;
  name: string | null;
  image: string | null;
  city: string | null;
  isOnline: boolean | null;
}

export interface FriendsDashboardData {
  friends: FriendUserSummary[];
  incomingRequests: Array<{
    friendshipId: string;
    createdAt: string;
    user: FriendUserSummary;
  }>;
  outgoingRequests: Array<{
    friendshipId: string;
    createdAt: string;
    user: FriendUserSummary;
  }>;
  blockedUsers: Array<{
    id: string;
    name: string | null;
    image: string | null;
  }>;
}

function computeIsOnline(
  showOnlineStatus: boolean,
  lastActiveAt: Date | null,
): boolean | null {
  if (!showOnlineStatus) return null;
  if (!lastActiveAt) return false;
  return Date.now() - lastActiveAt.getTime() <= ONLINE_WINDOW_MS;
}

export async function isBlockedBetween(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (userA === userB) return false;
  const count = await prisma.block.count({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
  return count > 0;
}

export async function areFriends(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (userA === userB) return false;
  const pairKey = canonicalPairKey(userA, userB);
  const friendship = await prisma.friendship.findUnique({
    where: { pairKey },
    select: { status: true },
  });
  return friendship?.status === "ACCEPTED";
}

export async function assertFriendsAndUnblocked(
  userA: string,
  userB: string,
): Promise<void> {
  if (userA === userB) {
    throw new ChatServiceError("Cannot target yourself", 400, "SELF_TARGET");
  }
  const [blocked, friends] = await Promise.all([
    isBlockedBetween(userA, userB),
    areFriends(userA, userB),
  ]);
  if (blocked) {
    throw new ChatServiceError("Action not allowed", 403, "BLOCKED");
  }
  if (!friends) {
    throw new ChatServiceError("Users must be friends first", 403, "NOT_FRIENDS");
  }
}

export async function getAcceptedFriendCount(userId: string): Promise<number> {
  return prisma.friendship.count({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });
}

export async function getRelationshipState(
  viewerId: string,
  targetId: string,
): Promise<RelationshipState> {
  if (viewerId === targetId) return "SELF";
  const pairKey = canonicalPairKey(viewerId, targetId);
  const [blocks, friendship] = await Promise.all([
    prisma.block.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: targetId },
          { blockerId: targetId, blockedId: viewerId },
        ],
      },
      select: { blockerId: true },
    }),
    prisma.friendship.findUnique({
      where: { pairKey },
      select: { status: true, requesterId: true },
    }),
  ]);

  if (blocks.some((b) => b.blockerId === viewerId)) return "BLOCKED_BY_ME";
  if (blocks.some((b) => b.blockerId === targetId)) return "BLOCKED_BY_THEM";
  if (!friendship || friendship.status === "DECLINED") return "NONE";
  if (friendship.status === "ACCEPTED") return "FRIENDS";
  return friendship.requesterId === viewerId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
}

async function assertValidTargetUser(targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      onboardingCompletedAt: true,
      chatBannedAt: true,
      friendRequestPolicy: true,
    },
  });
  if (!target || !target.onboardingCompletedAt || target.chatBannedAt) {
    throw new ChatServiceError("User not found", 404, "USER_NOT_FOUND");
  }
  return target;
}

export async function sendFriendRequest(
  actorId: string,
  targetUserId: string,
  options?: { bypassRateLimit?: boolean },
): Promise<{
  status: "PENDING" | "ACCEPTED";
  autoAccepted: boolean;
  alreadyExists: boolean;
  friendshipId: string;
}> {
  if (actorId === targetUserId) {
    throw new ChatServiceError(
      "Cannot send a friend request to yourself",
      400,
      "SELF_REQUEST",
    );
  }

  if (!options?.bypassRateLimit) {
    const allowed = await checkRateLimit(
      `friend-req:${actorId}`,
      FRIEND_REQUEST_DAILY_LIMIT,
      86400,
    );
    if (!allowed) {
      throw new ChatServiceError(
        "Daily friend request limit reached",
        429,
        "RATE_LIMITED",
      );
    }
  }

  const target = await assertValidTargetUser(targetUserId);
  if (await isBlockedBetween(actorId, targetUserId)) {
    throw new ChatServiceError(
      "Cannot send friend request to this user",
      403,
      "BLOCKED",
    );
  }

  const pairKey = canonicalPairKey(actorId, targetUserId);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.friendship.findUnique({
        where: { pairKey },
      });

      if (existing) {
        if (existing.status === "ACCEPTED") {
          return {
            status: "ACCEPTED",
            autoAccepted: false,
            alreadyExists: true,
            friendshipId: existing.id,
          };
        }
        if (existing.status === "PENDING") {
          if (existing.requesterId === actorId) {
            return {
              status: "PENDING",
              autoAccepted: false,
              alreadyExists: true,
              friendshipId: existing.id,
            };
          }
          const updated = await tx.friendship.update({
            where: { id: existing.id },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });
          return {
            status: "ACCEPTED",
            autoAccepted: true,
            alreadyExists: false,
            friendshipId: updated.id,
          };
        }
        if (target.friendRequestPolicy === "NOBODY") {
          throw new ChatServiceError(
            "This user is not accepting friend requests",
            403,
            "REQUESTS_DISABLED",
          );
        }
        const reopened = await tx.friendship.update({
          where: { id: existing.id },
          data: {
            requesterId: actorId,
            addresseeId: targetUserId,
            status: "PENDING",
            respondedAt: null,
          },
        });
        return {
          status: "PENDING",
          autoAccepted: false,
          alreadyExists: false,
          friendshipId: reopened.id,
        };
      }

      if (target.friendRequestPolicy === "NOBODY") {
        throw new ChatServiceError(
          "This user is not accepting friend requests",
          403,
          "REQUESTS_DISABLED",
        );
      }

      const created = await tx.friendship.create({
        data: {
          requesterId: actorId,
          addresseeId: targetUserId,
          pairKey,
          status: "PENDING",
        },
      });
      return {
        status: "PENDING",
        autoAccepted: false,
        alreadyExists: false,
        friendshipId: created.id,
      };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const raced = await prisma.friendship.findUnique({ where: { pairKey } });
      if (raced) {
        if (raced.status === "PENDING" && raced.requesterId !== actorId) {
          const accepted = await prisma.friendship.update({
            where: { id: raced.id },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });
          return {
            status: "ACCEPTED",
            autoAccepted: true,
            alreadyExists: false,
            friendshipId: accepted.id,
          };
        }
        return {
          status: raced.status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
          autoAccepted: false,
          alreadyExists: true,
          friendshipId: raced.id,
        };
      }
    }
    throw err;
  }
}

export async function cancelFriendRequest(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "CANCELED" }> {
  const pairKey = canonicalPairKey(actorId, targetUserId);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (
    !existing ||
    existing.status !== "PENDING" ||
    existing.requesterId !== actorId
  ) {
    throw new ChatServiceError(
      "No outgoing friend request to cancel",
      404,
      "REQUEST_NOT_FOUND",
    );
  }
  await prisma.friendship.delete({ where: { id: existing.id } });
  return { status: "CANCELED" };
}

export async function acceptFriendRequest(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "ACCEPTED"; friendshipId: string }> {
  if (await isBlockedBetween(actorId, targetUserId)) {
    throw new ChatServiceError("Cannot accept blocked user", 403, "BLOCKED");
  }
  const pairKey = canonicalPairKey(actorId, targetUserId);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (
    !existing ||
    existing.status !== "PENDING" ||
    existing.addresseeId !== actorId
  ) {
    throw new ChatServiceError(
      "No incoming friend request to accept",
      404,
      "REQUEST_NOT_FOUND",
    );
  }
  const updated = await prisma.friendship.update({
    where: { id: existing.id },
    data: { status: "ACCEPTED", respondedAt: new Date() },
  });
  return { status: "ACCEPTED", friendshipId: updated.id };
}

export async function declineFriendRequest(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "DECLINED"; friendshipId: string }> {
  const pairKey = canonicalPairKey(actorId, targetUserId);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (
    !existing ||
    existing.status !== "PENDING" ||
    existing.addresseeId !== actorId
  ) {
    throw new ChatServiceError(
      "No incoming friend request to decline",
      404,
      "REQUEST_NOT_FOUND",
    );
  }
  const updated = await prisma.friendship.update({
    where: { id: existing.id },
    data: { status: "DECLINED", respondedAt: new Date() },
  });
  return { status: "DECLINED", friendshipId: updated.id };
}

export async function unfriendUser(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "UNFRIENDED" }> {
  const pairKey = canonicalPairKey(actorId, targetUserId);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (!existing || existing.status !== "ACCEPTED") {
    throw new ChatServiceError("Friendship not found", 404, "NOT_FRIENDS");
  }
  await prisma.friendship.delete({ where: { id: existing.id } });
  return { status: "UNFRIENDED" };
}

export async function blockUser(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "BLOCKED" }> {
  if (actorId === targetUserId) {
    throw new ChatServiceError("Cannot block yourself", 400, "SELF_BLOCK");
  }
  const exists = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!exists) {
    throw new ChatServiceError("User not found", 404, "USER_NOT_FOUND");
  }

  const pairKey = canonicalPairKey(actorId, targetUserId);

  await prisma.$transaction(async (tx) => {
    const existingBlock = await tx.block.findUnique({
      where: {
        blockerId_blockedId: { blockerId: actorId, blockedId: targetUserId },
      },
      select: { id: true },
    });
    if (!existingBlock) {
      await tx.block.createMany({
        data: [{ blockerId: actorId, blockedId: targetUserId }],
        skipDuplicates: true,
      });
    }
    await tx.friendship.deleteMany({ where: { pairKey } });
    await tx.invite.updateMany({
      where: {
        status: "PENDING",
        OR: [
          { inviterId: actorId, inviteeId: targetUserId },
          { inviterId: targetUserId, inviteeId: actorId },
        ],
      },
      data: { status: "REVOKED" },
    });
  });

  return { status: "BLOCKED" };
}

export async function unblockUser(
  actorId: string,
  targetUserId: string,
): Promise<{ status: "UNBLOCKED" }> {
  await prisma.block.deleteMany({
    where: { blockerId: actorId, blockedId: targetUserId },
  });
  return { status: "UNBLOCKED" };
}

export async function getFriendsDashboardData(
  userId: string,
): Promise<FriendsDashboardData> {
  const [friendships, blocks] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        status: { in: ["ACCEPTED", "PENDING"] },
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      orderBy: { updatedAt: "desc" },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            image: true,
            city: true,
            showOnlineStatus: true,
            lastActiveAt: true,
            chatBannedAt: true,
          },
        },
        addressee: {
          select: {
            id: true,
            name: true,
            image: true,
            city: true,
            showOnlineStatus: true,
            lastActiveAt: true,
            chatBannedAt: true,
          },
        },
      },
    }),
    prisma.block.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      include: {
        blocked: {
          select: { id: true, name: true, image: true },
        },
      },
    }),
  ]);

  const blockedIds = new Set<string>();
  const blockedUsers: FriendsDashboardData["blockedUsers"] = [];
  for (const b of blocks) {
    const other = b.blockerId === userId ? b.blockedId : b.blockerId;
    blockedIds.add(other);
    if (b.blockerId === userId) {
      blockedUsers.push({
        id: b.blocked.id,
        name: b.blocked.name,
        image: b.blocked.image,
      });
    }
  }

  const friends: FriendUserSummary[] = [];
  const incomingRequests: FriendsDashboardData["incomingRequests"] = [];
  const outgoingRequests: FriendsDashboardData["outgoingRequests"] = [];

  for (const f of friendships) {
    const isRequester = f.requesterId === userId;
    const other = isRequester ? f.addressee : f.requester;
    if (blockedIds.has(other.id) || other.chatBannedAt) continue;

    const summary: FriendUserSummary = {
      id: other.id,
      name: other.name,
      image: other.image,
      city: other.city,
      isOnline: computeIsOnline(other.showOnlineStatus, other.lastActiveAt),
    };

    if (f.status === "ACCEPTED") {
      friends.push(summary);
    } else if (f.status === "PENDING") {
      if (isRequester) {
        outgoingRequests.push({
          friendshipId: f.id,
          createdAt: f.createdAt.toISOString(),
          user: summary,
        });
      } else {
        incomingRequests.push({
          friendshipId: f.id,
          createdAt: f.createdAt.toISOString(),
          user: summary,
        });
      }
    }
  }

  return { friends, incomingRequests, outgoingRequests, blockedUsers };
}

export async function searchUsersByNamePrefix(
  viewerId: string,
  rawQuery: string,
  options?: { bypassRateLimit?: boolean },
): Promise<
  Array<{
    id: string;
    name: string | null;
    image: string | null;
    city: string | null;
    relationship: RelationshipState;
    canReceiveFriendRequest: boolean;
  }>
> {
  const query = rawQuery.trim();
  if (query.length < 3) {
    throw new ChatServiceError(
      "Search query must be at least 3 characters",
      400,
      "QUERY_TOO_SHORT",
    );
  }
  if (query.length > 60) {
    throw new ChatServiceError("Search query is too long", 400, "QUERY_TOO_LONG");
  }

  if (!options?.bypassRateLimit) {
    const allowed = await checkRateLimit(
      `user-search:${viewerId}`,
      USER_SEARCH_PER_MIN_LIMIT,
      60,
    );
    if (!allowed) {
      throw new ChatServiceError(
        "Too many search requests",
        429,
        "RATE_LIMITED",
      );
    }
  }

  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const excludedIds = new Set<string>([viewerId]);
  for (const b of blocks) {
    excludedIds.add(b.blockerId);
    excludedIds.add(b.blockedId);
  }

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(excludedIds) },
      onboardingCompletedAt: { not: null },
      chatBannedAt: null,
      name: { startsWith: query, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      image: true,
      city: true,
      friendRequestPolicy: true,
    },
    orderBy: { name: "asc" },
    take: 12,
  });

  if (users.length === 0) return [];

  const pairKeys = users.map((u) => canonicalPairKey(viewerId, u.id));
  const friendships = await prisma.friendship.findMany({
    where: { pairKey: { in: pairKeys } },
    select: { pairKey: true, status: true, requesterId: true },
  });
  const friendshipMap = new Map(friendships.map((f) => [f.pairKey, f]));

  return users.map((u) => {
    const f = friendshipMap.get(canonicalPairKey(viewerId, u.id));
    let relationship: RelationshipState = "NONE";
    if (f) {
      if (f.status === "ACCEPTED") relationship = "FRIENDS";
      else if (f.status === "PENDING") {
        relationship = f.requesterId === viewerId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
      }
    }
    return {
      id: u.id,
      name: u.name,
      image: u.image,
      city: u.city,
      relationship,
      canReceiveFriendRequest: u.friendRequestPolicy === "EVERYONE",
    };
  });
}

export async function getPublicProfile(
  viewerId: string,
  targetId: string,
): Promise<PublicProfileData | null> {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      image: true,
      coverImage: true,
      coverWidth: true,
      coverHeight: true,
      bio: true,
      city: true,
      onboardingCompletedAt: true,
      chatBannedAt: true,
      showFriendCount: true,
      showOnlineStatus: true,
      friendRequestPolicy: true,
      lastActiveAt: true,
    },
  });

  if (!target || !target.onboardingCompletedAt || target.chatBannedAt) {
    return null;
  }

  const relationship = await getRelationshipState(viewerId, targetId);

  if (relationship === "BLOCKED_BY_THEM") {
    return {
      id: target.id,
      name: target.name,
      image: null,
      coverImage: null,
      coverWidth: null,
      coverHeight: null,
      bio: null,
      city: null,
      friendCount: null,
      isOnline: null,
      relationship,
      canReceiveFriendRequest: false,
    };
  }

  if (relationship === "BLOCKED_BY_ME") {
    return {
      id: target.id,
      name: target.name,
      image: target.image,
      coverImage: null,
      coverWidth: null,
      coverHeight: null,
      bio: null,
      city: null,
      friendCount: null,
      isOnline: null,
      relationship,
      canReceiveFriendRequest: false,
    };
  }

  const shouldIncludeFriendCount =
    viewerId === targetId || target.showFriendCount;

  const friendCount = shouldIncludeFriendCount
    ? await getAcceptedFriendCount(target.id)
    : null;

  return {
    id: target.id,
    name: target.name,
    image: target.image,
    coverImage: target.coverImage,
    coverWidth: target.coverWidth,
    coverHeight: target.coverHeight,
    bio: target.bio,
    city: target.city,
    friendCount,
    isOnline: computeIsOnline(target.showOnlineStatus, target.lastActiveAt),
    relationship,
    canReceiveFriendRequest: target.friendRequestPolicy === "EVERYONE",
  };
}
