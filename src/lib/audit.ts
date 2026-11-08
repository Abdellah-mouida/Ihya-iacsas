import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditClient = Prisma.TransactionClient | typeof prisma;

export interface LogActivityParams {
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown> | null;
  /** Use the transaction client when the activity must commit with its mutation. */
  client?: AuditClient;
  /** Re-throw write failures for audit records that are part of a required transaction. */
  required?: boolean;
}

const SENSITIVE_DETAIL_KEY = /(password|otp|token|secret|request|body|credential)/i;

/** Remove secret-like metadata keys and bound values before persisting audit metadata. */
export function sanitizeAuditDetails(
  value: unknown,
  depth = 0,
): Prisma.InputJsonValue | undefined {
  if (depth > 4) return undefined;
  if (typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return value.slice(0, 500);
  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeAuditDetails(item, depth + 1))
      .filter((item): item is Prisma.InputJsonValue => item !== undefined);
  }
  if (typeof value !== "object") return undefined;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SENSITIVE_DETAIL_KEY.test(key))
    .slice(0, 30)
    .flatMap(([key, item]) => {
      const safe = sanitizeAuditDetails(item, depth + 1);
      return safe === undefined ? [] : [[key.slice(0, 80), safe] as const];
    });

  return Object.fromEntries(entries);
}

/** Central, best-effort audit writer. IP addresses and user agents are intentionally omitted. */
export async function logActivity({ client, details, required = false, ...entry }: LogActivityParams) {
  try {
    const db = client ?? prisma;
    const safeDetails = sanitizeAuditDetails(details);
    return await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorName: entry.actorName ?? null,
        actorEmail: entry.actorEmail ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        targetName: entry.targetName ?? null,
        targetEmail: entry.targetEmail ?? null,
        details: safeDetails ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error("[audit] Failed to create activity log entry:", error);
    if (required) throw error;
    return null;
  }
}
