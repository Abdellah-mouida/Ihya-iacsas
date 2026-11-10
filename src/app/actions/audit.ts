"use server";

import { isAuditPermissionError, logAuditFailure } from "@/lib/audit-errors";
import {
  AUDIT_LOG_ACTOR_INCLUDE,
  buildAdminAuditLogQuery,
  type AuditLogWithActor,
} from "@/lib/audit-query";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type GetAdminAuditLogsParams = {
  query?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
};

const PAGE_SIZE = 20;

export type AuditLogsFailureKind = "permission" | "server";
export type GetAdminAuditLogsResult =
  | { success: true; logs: AuditLogWithActor[]; nextCursor: string | null }
  | { success: false; kind: AuditLogsFailureKind; digest?: string };

export async function getAdminAuditLogs(
  input: GetAdminAuditLogsParams = {},
): Promise<GetAdminAuditLogsResult> {
  try {
    await requirePermission("audit:view");
    const { filters, where } = buildAdminAuditLogQuery(input);
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
      include: AUDIT_LOG_ACTOR_INCLUDE,
    });

    const hasMore = rows.length > PAGE_SIZE;
    const logs = rows.slice(0, PAGE_SIZE);
    return {
      success: true,
      logs,
      nextCursor: hasMore ? logs[logs.length - 1]?.id ?? null : null,
    };
  } catch (error) {
    if (isAuditPermissionError(error)) return { success: false, kind: "permission" };
    return { success: false, kind: "server", digest: logAuditFailure("admin activity query", error) };
  }
}
