import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import {
  promoteNextWaitlistedBooking,
  type PromotionActor,
  type PromotionDependencies,
} from "@/lib/booking-promotion";

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

    await tx.user.delete({ where: { id: targetUserId } });

    return {
      eventIds: [...new Set(confirmedLimitedBookings.map((booking) => booking.eventId))],
      actor: {
        id: actorId === targetUserId ? null : actorId,
        name: actor.name,
        email: actor.email,
      } satisfies PromotionActor,
    };
  });

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
