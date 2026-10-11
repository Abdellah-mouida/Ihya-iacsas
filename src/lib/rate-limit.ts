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
    const now = new Date();
    const expiresAt = new Date(Date.now() + windowSeconds * 1000);

    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!record || record.expiresAt < now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { allowed: true };
    }

    if (record.count >= limit) {
      const remainingSeconds = Math.ceil(
        (record.expiresAt.getTime() - now.getTime()) / 1000,
      );
      return { allowed: false, retryAfter: Math.max(1, remainingSeconds) };
    }

    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

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
