import { createHash } from "node:crypto";

import { ForbiddenError, UnauthorizedError } from "@/lib/permissions";

export type AuditFailureKind = "permission" | "network" | "server";

export function isAuditPermissionError(error: unknown): boolean {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError;
}

export function logAuditFailure(context: string, error: unknown): string {
  const detail = error instanceof Error
    ? `${error.name}:${error.message}\n${error.stack ?? ""}`
    : String(error);
  const digest = createHash("sha256").update(detail).digest("hex").slice(0, 16);
  console.error(`[audit] ${context} failed (digest=${digest})`, error);
  return digest;
}
