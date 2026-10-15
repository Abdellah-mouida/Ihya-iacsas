"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export interface GetAdminUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export async function getAdminUsers({
  page = 1,
  limit = 10,
  search = "",
  role = "ALL",
}: GetAdminUsersParams = {}) {
  await requirePermission("users:view");

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  // Build where query
  const where: any = {};

  if (role && role !== "ALL" && Object.values(Role).includes(role as Role)) {
    where.role = role as Role;
  }

  const cleanSearch = search.trim();
  if (cleanSearch) {
    where.OR = [
      { name: { contains: cleanSearch, mode: "insensitive" } },
      { email: { contains: cleanSearch, mode: "insensitive" } },
      { city: { contains: cleanSearch, mode: "insensitive" } },
    ];
  }

  const [users, total, totalUsers, totalAdmins, totalModerators, thirtyDaysActive] =
    await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          role: true,
          city: true,
          age: true,
          locale: true,
          lastLoginAt: true,
          lastActiveAt: true,
          createdAt: true,
          updatedAt: true,
          accounts: {
            select: {
              provider: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              auditLogs: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.MODERATOR } }),
      prisma.user.count({
        where: {
          lastActiveAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    success: true,
    users,
    total,
    page: safePage,
    totalPages,
    stats: {
      totalUsers,
      totalAdmins,
      totalModerators,
      activeLast30Days: thirtyDaysActive,
    },
  };
}

export async function updateUserRole({
  userId,
  newRole,
  reason,
}: {
  userId: string;
  newRole: Role;
  reason?: string;
}) {
  const actor = await requirePermission("users:manage_roles");

  if (!Object.values(Role).includes(newRole)) {
    throw new Error("Invalid role specified.");
  }

  if (actor.id === userId) {
    throw new Error("You cannot change your own administrative role.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  // Prevent demoting the last remaining ADMIN
  if (targetUser.role === Role.ADMIN && newRole !== Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot demote the only remaining administrator.");
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: newRole,
      sessionVersion: { increment: 1 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      updatedAt: true,
    },
  });

  await createAuditLog({
    actorId: actor.id,
    action: "USER_ROLE_UPDATE",
    targetType: "USER",
    targetId: userId,
    details: {
      targetEmail: targetUser.email,
      previousRole: targetUser.role,
      newRole,
      reason: reason?.trim() || "Role updated in admin panel",
    },
  });

  revalidatePath("/admin/users");
  return { success: true, user: updated };
}

export async function deleteOrAnonymizeUser({
  userId,
  action,
  reason,
}: {
  userId: string;
  action: "delete" | "anonymize";
  reason?: string;
}) {
  const actor = await requirePermission("users:delete");

  if (actor.id === userId) {
    throw new Error("You cannot delete or anonymize your own account.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!targetUser) {
    throw new Error("User not found.");
  }

  // Prevent deleting the last remaining ADMIN
  if (targetUser.role === Role.ADMIN) {
    const adminCount = await prisma.user.count({
      where: { role: Role.ADMIN },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot remove the only remaining administrator.");
    }
  }

  if (action === "anonymize") {
    await prisma.$transaction(async (tx) => {
      // Remove linked accounts and active sessions
      await tx.account.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });

      // Anonymize user details but preserve ID so existing bookings/stats remain valid
      await tx.user.update({
        where: { id: userId },
        data: {
          name: "Anonymous User",
          email: `anonymized-${userId}@ihyaa.internal`,
          emailVerified: null,
          image: null,
          passwordHash: null,
          city: null,
          age: null,
          imagePublicId: null,
          role: Role.USER,
          sessionVersion: { increment: 1 },
        },
      });
    });
  } else {
    // Permanent deletion
    await prisma.$transaction(async (tx) => {
      // Delete user: sessions & accounts cascade; bookings userId set to null by relation
      await tx.user.delete({
        where: { id: userId },
      });
    });
  }

  await createAuditLog({
    actorId: actor.id,
    action: action === "delete" ? "USER_DELETE" : "USER_ANONYMIZE",
    targetType: "USER",
    targetId: userId,
    details: {
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
      action,
      reason: reason?.trim() || `User ${action}d via admin panel`,
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function getUserAuditLogs(userId: string) {
  await requirePermission("audit:view");

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [{ targetId: userId }, { actorId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return { success: true, logs };
}
