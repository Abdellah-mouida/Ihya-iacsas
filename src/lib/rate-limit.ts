import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export interface RateLimitOptions {
  failOpen?: boolean;
  queryRawFn?: (
    id: string,
    key: string,
    expiresAt: Date,
  ) => Promise<Array<{ count: number; expiresAt: Date }>>;
}

async function defaultRateLimitQuery(
  id: string,
  key: string,
  expiresAt: Date,
): Promise<Array<{ count: number; expiresAt: Date }>> {
  return prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimit" ("id", "key", "count", "expiresAt", "createdAt", "updatedAt")
    VALUES (${id}, ${key}, 1, ${expiresAt}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."expiresAt" < NOW() THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimit"."expiresAt" < NOW() THEN EXCLUDED."expiresAt"
        ELSE "RateLimit"."expiresAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "expiresAt"
  `;
}

/**
 * Atomic database-backed sliding window rate limiter.
 * Fails closed by default on database errors to protect sensitive endpoints.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  options?: RateLimitOptions,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const failOpen = options?.failOpen ?? false;
  const runQuery = options?.queryRawFn ?? defaultRateLimitQuery;

  try {
    const now = Date.now();
    const expiresAt = new Date(now + windowSeconds * 1000);
    const id = randomUUID();

    const rows = await runQuery(id, key, expiresAt);
    const row = rows[0];
    if (!row) {
      return failOpen ? { allowed: true } : { allowed: false, retryAfter: 60 };
    }

    if (row.count > limit) {
      const remainingSeconds = Math.ceil(
        (new Date(row.expiresAt).getTime() - now) / 1000,
      );
      return { allowed: false, retryAfter: Math.max(1, remainingSeconds) };
    }

    return { allowed: true };
  } catch {
    if (failOpen) {
      return { allowed: true };
    }
    return { allowed: false, retryAfter: Math.min(60, Math.max(5, windowSeconds)) };
  }
}

/**
 * Clear rate limit entry for testing or lockout reset
 */
export async function clearRateLimit(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch {
    // ignore
  }
}
