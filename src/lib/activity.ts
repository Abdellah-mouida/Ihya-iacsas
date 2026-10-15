import { prisma } from "@/lib/prisma";

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export async function touchUserActive(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const fiveMinutesAgo = new Date(Date.now() - ACTIVITY_THROTTLE_MS);

    // Atomic update only when lastActiveAt is null or older than 5 minutes
    await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: fiveMinutesAgo } },
        ],
      },
      data: {
        lastActiveAt: new Date(),
      },
    });
  } catch (error) {
    console.warn("[activity] Failed to update lastActiveAt for user:", userId, error);
  }
}
