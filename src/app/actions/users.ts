"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { deleteUserAccount } from "@/lib/user-deletion";
import { AUDIT_ACTION_KEYS } from "@/lib/audit-actions";

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
  const where: Prisma.UserWhereInput = {};

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
          bio: true,
          studyLevel: true,
          institution: true,
          interests: true,
          skills: true,
          languages: true,
          volunteerAreas: true,
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

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "USER_ROLE_UPDATE",
    targetType: "USER",
    targetId: userId,
    targetName: updated.name,
    targetEmail: updated.email,
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
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "USER_ANONYMIZE",
      targetType: "USER",
      targetId: userId,
      targetName: targetUser.name,
      targetEmail: targetUser.email,
      details: {
        targetRole: targetUser.role,
        action,
        reason: reason?.trim() || "User anonymized via admin panel",
      },
    });
  } else {
    await deleteUserAccount({
      targetUserId: userId,
      actorId: actor.id,
      action: "USER_DELETE",
      reason: reason?.trim() || "User deleted via admin panel",
    });
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function getUserAuditLogs(
  userId: string,
  options: { action?: string; cursor?: string | null } = {},
) {
  await requirePermission("audit:view");

  if (!userId || userId.length > 128) {
    return { success: false, logs: [], nextCursor: null };
  }
  const action = options.action && options.action !== "ALL" ? options.action : undefined;
  if (action && !AUDIT_ACTION_KEYS.includes(action as (typeof AUDIT_ACTION_KEYS)[number])) {
    return { success: false, logs: [], nextCursor: null };
  }
  const cursor = options.cursor && options.cursor.length <= 128 ? options.cursor : undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      AND: [
        { OR: [{ targetId: userId }, { actorId: userId }] },
        ...(action ? [{ action }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 21,
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

  const hasMore = logs.length > 20;
  const page = hasMore ? logs.slice(0, 20) : logs;
  return {
    success: true,
    logs: page,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}
