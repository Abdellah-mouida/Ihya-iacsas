import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditLog({
  actorId,
  actorName,
  actorEmail,
  action,
  targetType,
  targetId,
  targetName,
  targetEmail,
  details,
  ipAddress,
  userAgent,
}: CreateAuditLogParams) {
  try {
    return await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        actorName: actorName ?? null,
        actorEmail: actorEmail ?? null,
        action,
        targetType,
        targetId: targetId ?? null,
        targetName: targetName ?? null,
        targetEmail: targetEmail ?? null,
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
