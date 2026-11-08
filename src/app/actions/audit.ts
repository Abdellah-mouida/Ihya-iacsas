"use server";

import { Prisma } from "@prisma/client";

import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTION_KEYS } from "@/lib/audit-actions";

export type GetAdminAuditLogsParams = {
  query?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
};

const PAGE_SIZE = 20;

function parseDay(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid audit date filter.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid audit date filter.");
  }
  return date;
}

export async function getAdminAuditLogs({
  query = "",
  action = "ALL",
  from,
  to,
  cursor = null,
}: GetAdminAuditLogsParams = {}) {
  await requirePermission("audit:view");

  if (action !== "ALL" && !AUDIT_ACTION_KEYS.includes(action as typeof AUDIT_ACTION_KEYS[number])) {
    throw new Error("Invalid audit action filter.");
  }
  if (cursor && (cursor.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    throw new Error("Invalid audit cursor.");
  }

  const fromDate = parseDay(from);
  const toDate = parseDay(to);
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error("Invalid audit date range.");
  }
  if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1);

  const and: Prisma.AuditLogWhereInput[] = [];
  if (action !== "ALL") and.push({ action });
  if (fromDate || toDate) {
    and.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lt: toDate } : {}),
      },
    });
  }
  const cleanQuery = query.trim().slice(0, 120);
  if (cleanQuery) {
    and.push({
      OR: [
        { actorName: { contains: cleanQuery, mode: "insensitive" } },
        { actorEmail: { contains: cleanQuery, mode: "insensitive" } },
        { targetName: { contains: cleanQuery, mode: "insensitive" } },
        { targetEmail: { contains: cleanQuery, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
    include: {
      actor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const logs = rows.slice(0, PAGE_SIZE);
  return {
    success: true,
    logs,
    nextCursor: hasMore ? logs[logs.length - 1]?.id ?? null : null,
  };
}
