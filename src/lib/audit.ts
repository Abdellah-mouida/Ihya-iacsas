import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditLog({
  actorId,
  action,
  targetType,
  targetId,
  details,
  ipAddress,
  userAgent,
}: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        targetType,
        targetId: targetId ?? null,
        details: (details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to create audit log entry:", error);
    return null;
  }
}
