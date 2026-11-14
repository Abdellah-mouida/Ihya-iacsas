import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import {
  promoteNextWaitlistedBooking,
  type PromotionActor,
  type PromotionDependencies,
} from "@/lib/booking-promotion";
import {
  decryptMessage,
  encryptMessage,
  loadKeyringFromEnv,
} from "@/lib/chat/crypto-core";

type UserDeletionAction = "USER_DELETE" | "ACCOUNT_DELETE";

export async function deleteUserAccount({
  targetUserId,
  actorId,
  action,
  reason,
}: {
  targetUserId: string;
  actorId: string;
  action: UserDeletionAction;
  reason?: string;
}, dependencies: PromotionDependencies = {}) {
  const deletion = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!target) throw new Error("User not found.");

    if (target.role === "ADMIN") {
      const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        throw new Error("Cannot remove the only remaining administrator.");
      }
    }

    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!actor) throw new Error("Deleting actor not found.");

    const confirmedLimitedBookings = await tx.booking.findMany({
      where: {
        userId: targetUserId,
        OR: [{ status: "CONFIRMED" }, { confirmed: true }],
        event: { is: { capacityType: "LIMITED" } },
      },
      select: { eventId: true },
    });

    const snapshot = {
      actorName: target.name,
      actorEmail: target.email,
      actorRole: target.role,
    };
    await tx.auditLog.updateMany({
      where: { actorId: targetUserId },
      data: snapshot,
    });
    await tx.auditLog.updateMany({
      where: { targetId: targetUserId },
      data: { targetName: target.name, targetEmail: target.email },
    });

    await logActivity({
      client: tx,
      required: true,
      actorId,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      targetType: "USER",
      targetId: target.id,
      targetName: target.name,
      targetEmail: target.email,
      details: {
        targetRole: target.role,
        reason: reason?.trim() || (action === "ACCOUNT_DELETE" ? "User deleted own account" : "User deleted by administrator"),
      },
    });

    const ownedRooms = await tx.conversation.findMany({
      where: { ownerId: targetUserId, type: "ROOM" },
      select: {
        id: true,
        members: {
          where: { leftAt: null, userId: { not: targetUserId } },
          orderBy: { joinedAt: "asc" },
          take: 1,
          select: { id: true, userId: true },
        },
      },
    });
    for (const room of ownedRooms) {
      const nextOwner = room.members[0];
      if (nextOwner) {
        await tx.conversation.update({
          where: { id: room.id },
          data: { ownerId: nextOwner.userId },
        });
        await tx.conversationMember.update({
          where: { id: nextOwner.id },
          data: { role: "OWNER" },
        });
      } else {
        await tx.conversation.delete({ where: { id: room.id } });
      }
    }

    await tx.conversation.deleteMany({
      where: {
        type: "DM",
        members: { some: { userId: targetUserId } },
      },
    });

    await tx.message.updateMany({
      where: { senderId: targetUserId, deletedAt: { not: null } },
      data: { senderId: null, isAnonymized: true },
    });

    const activeMessages = await tx.message.findMany({
      where: { senderId: targetUserId, deletedAt: null },
      select: {
        id: true,
        conversationId: true,
        ciphertext: true,
        nonce: true,
        keyVersion: true,
      },
    });
    if (activeMessages.length > 0) {
      const keyring = loadKeyringFromEnv();
      for (const msg of activeMessages) {
        if (!msg.ciphertext || !msg.nonce) {
          await tx.message.update({
            where: { id: msg.id },
            data: { senderId: null, isAnonymized: true },
          });
          continue;
        }
        const plaintext = decryptMessage(
          {
            ciphertext: msg.ciphertext,
            nonce: msg.nonce,
            keyVersion: msg.keyVersion,
            conversationId: msg.conversationId,
            messageId: msg.id,
            senderId: targetUserId,
          },
          keyring,
        );
        const reencrypted = encryptMessage(
          {
            plaintext,
            conversationId: msg.conversationId,
            messageId: msg.id,
            senderId: "anonymized",
          },
          keyring,
        );
        await tx.message.update({
          where: { id: msg.id },
          data: {
            senderId: null,
            isAnonymized: true,
            ciphertext: reencrypted.ciphertext,
            nonce: reencrypted.nonce,
            keyVersion: reencrypted.keyVersion,
          },
        });
      }
    }

    await tx.friendship.deleteMany({
      where: { OR: [{ requesterId: targetUserId }, { addresseeId: targetUserId }] },
    });
    await tx.block.deleteMany({
      where: { OR: [{ blockerId: targetUserId }, { blockedId: targetUserId }] },
    });
    await tx.conversationMember.deleteMany({
      where: { userId: targetUserId },
    });

    await tx.user.delete({ where: { id: targetUserId } });

    return {
      eventIds: [...new Set(confirmedLimitedBookings.map((booking) => booking.eventId))],
      actor: {
        id: actorId === targetUserId ? null : actorId,
        name: actor.name,
        email: actor.email,
      } satisfies PromotionActor,
    };
  }, { timeout: 15000 });

  for (const eventId of deletion.eventIds) {
    try {
      await promoteNextWaitlistedBooking(
        eventId,
        deletion.actor,
        action === "ACCOUNT_DELETE" ? "ACCOUNT_DELETE" : "USER_DELETE",
        dependencies,
      );
    } catch (error) {
      console.error(`[account:${targetUserId}] Waitlist promotion failed for event ${eventId}:`, error);
    }
  }

  return { success: true };
}
