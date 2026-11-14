import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Database-backed sliding window rate limiter
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const now = Date.now();
    const expiresAt = new Date(now + windowSeconds * 1000);
    const id = randomUUID();

    const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
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

    const row = rows[0];
    if (!row) return { allowed: true };

    if (row.count > limit) {
      const remainingSeconds = Math.ceil(
        (new Date(row.expiresAt).getTime() - now) / 1000,
      );
      return { allowed: false, retryAfter: Math.max(1, remainingSeconds) };
    }

    return { allowed: true };
  } catch {
    // If rate limit table is temporarily unreachable, allow gracefully
    return { allowed: true };
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
