import { Prisma } from "@prisma/client";
import { z } from "zod";

import { AUDIT_ACTION_KEYS } from "@/lib/audit-actions";

const dateFilter = z.string().optional().default("").superRefine((value, context) => {
  if (!value) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    context.addIssue({ code: "custom", message: "Invalid date filter." });
    return;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: "custom", message: "Invalid date filter." });
  }
});

const auditFilterSchema = z.object({
  query: z.string().optional().default("").transform((value) => value.trim().slice(0, 120)),
  action: z.enum(AUDIT_ACTION_KEYS).or(z.literal("ALL")).optional().default("ALL"),
  from: dateFilter,
  to: dateFilter,
  cursor: z.union([z.string().max(64).regex(/^[a-zA-Z0-9_-]+$/), z.null()]).optional().default(null),
}).superRefine(({ from, to }, context) => {
  if (from && to && from > to) {
    context.addIssue({ code: "custom", message: "Invalid audit date range.", path: ["to"] });
  }
});

export const AUDIT_LOG_ACTOR_INCLUDE = {
  actor: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.AuditLogInclude;

export type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: typeof AUDIT_LOG_ACTOR_INCLUDE;
}>;

export type AuditFilterInput = {
  query?: string;
  action?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
};
export type AuditFilter = z.output<typeof auditFilterSchema>;

export function parseAuditFilters(input: AuditFilterInput = {}): AuditFilter {
  return auditFilterSchema.parse(input);
}

export function buildAdminAuditLogQuery(input: AuditFilterInput = {}): {
  filters: AuditFilter;
  where: Prisma.AuditLogWhereInput;
} {
  const filters = parseAuditFilters(input);
  const and: Prisma.AuditLogWhereInput[] = [];

  if (filters.action !== "ALL") and.push({ action: filters.action });
  if (filters.from || filters.to) {
    const fromDate = filters.from ? new Date(`${filters.from}T00:00:00.000Z`) : undefined;
    const toDate = filters.to ? new Date(`${filters.to}T00:00:00.000Z`) : undefined;
    if (toDate) toDate.setUTCDate(toDate.getUTCDate() + 1);
    and.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lt: toDate } : {}),
      },
    });
  }
  if (filters.query) {
    and.push({
      OR: [
        { actorName: { contains: filters.query, mode: "insensitive" } },
        { actorEmail: { contains: filters.query, mode: "insensitive" } },
        { targetName: { contains: filters.query, mode: "insensitive" } },
        { targetEmail: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  return { filters, where: and.length ? { AND: and } : {} };
}

export function buildUserAuditLogWhere(
  userId: string,
  action: string | undefined,
): Prisma.AuditLogWhereInput {
  const selectedAction = action && action !== "ALL"
    ? z.enum(AUDIT_ACTION_KEYS).parse(action)
    : undefined;
  return {
    AND: [
      { OR: [{ targetId: userId }, { actorId: userId }] },
      ...(selectedAction ? [{ action: selectedAction }] : []),
    ],
  };
}
