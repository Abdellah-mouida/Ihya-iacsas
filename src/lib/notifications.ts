import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userChannel } from "@/lib/chat/realtime";
import { publishChange } from "@/lib/realtime/publish";
import {
  getNotificationDefinition,
  sanitizeNotificationRecordFields,
  type NotificationItemDTO,
  type NotificationParamMap,
  type NotificationType,
} from "./notifications-shared";

export type NotificationDbRow = {
  id: string;
  userId: string;
  type: string;
  i18nKey: string;
  params: unknown;
  data: unknown;
  dedupeKey: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export interface NotificationDbAdapter {
  notification: {
    findFirst: (args: {
      where: {
        userId: string;
        dedupeKey: string;
        createdAt: { gte: Date };
      };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
    count: (args: {
      where: {
        userId: string;
        type: string;
        createdAt: { gte: Date };
      };
    }) => Promise<number>;
    create: (args: {
      data: {
        userId: string;
        type: string;
        i18nKey: string;
        params: Prisma.InputJsonValue;
        data: Prisma.InputJsonValue;
        dedupeKey?: string;
      };
    }) => Promise<NotificationDbRow>;
  };
}

export interface NotifyOptions {
  params?: Record<string, string | number | boolean | null | undefined>;
  data?: Record<string, string | number | boolean | null | undefined>;
  dedupeKey?: string;
  tx?: Prisma.TransactionClient;
  skipRealtime?: boolean;
  now?: Date;
}

export interface NotifyDeps {
  db: NotificationDbAdapter;
  publish?: (userId: string, row: NotificationDbRow) => Promise<void>;
}

function normalizeJsonMap(val: unknown): NotificationParamMap {
  if (!val || typeof val !== "object" || Array.isArray(val)) return {};
  const out: NotificationParamMap = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      out[k] = v;
    }
  }
  return out;
}

export function toNotificationDTO(row: NotificationDbRow): NotificationItemDTO {
  return {
    id: row.id,
    type: row.type,
    i18nKey: row.i18nKey,
    params: normalizeJsonMap(row.params),
    data: normalizeJsonMap(row.data),
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function publishNotificationRealtime(
  row: Pick<NotificationDbRow, "id" | "userId" | "type" | "createdAt">,
): Promise<void> {
  await publishChange([userChannel(row.userId)], {
    type: "notification.created",
    notificationId: row.id,
    notificationType: row.type,
    createdAt: row.createdAt.toISOString(),
  });
}

export async function notifyWithDeps(
  deps: NotifyDeps,
  userId: string,
  type: NotificationType,
  options?: NotifyOptions,
): Promise<NotificationItemDTO | null> {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return null;

  const def = getNotificationDefinition(type);
  if (!def) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  const now = options?.now ?? new Date();
  const cleanDedupeKey = options?.dedupeKey?.trim().slice(0, 160) || undefined;

  if (cleanDedupeKey) {
    const dedupeSince = new Date(now.getTime() - def.dedupeWindowMs);
    const existing = await deps.db.notification.findFirst({
      where: {
        userId: cleanUserId,
        dedupeKey: cleanDedupeKey,
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    });
    if (existing) {
      return null;
    }
  }

  if (def.rateLimitWindowMs > 0 && def.rateLimitMax > 0) {
    const windowSince = new Date(now.getTime() - def.rateLimitWindowMs);
    const recentCount = await deps.db.notification.count({
      where: {
        userId: cleanUserId,
        type: def.type,
        createdAt: { gte: windowSince },
      },
    });
    if (recentCount >= def.rateLimitMax) {
      return null;
    }
  }

  const sanitizedParams = sanitizeNotificationRecordFields(options?.params);
  const sanitizedData = sanitizeNotificationRecordFields(options?.data);

  const row = await deps.db.notification.create({
    data: {
      userId: cleanUserId,
      type: def.type,
      i18nKey: `notifications.types.${def.type}`,
      params: sanitizedParams as Prisma.InputJsonValue,
      data: sanitizedData as Prisma.InputJsonValue,
      ...(cleanDedupeKey ? { dedupeKey: cleanDedupeKey } : {}),
    },
  });

  if (!options?.tx && !options?.skipRealtime && deps.publish) {
    await deps.publish(cleanUserId, row);
  }

  return toNotificationDTO(row);
}

export async function notify(
  userId: string,
  type: NotificationType,
  options?: NotifyOptions,
): Promise<NotificationItemDTO | null> {
  try {
    const db: NotificationDbAdapter = options?.tx ?? prisma;
    return await notifyWithDeps(
      {
        db,
        publish: async (_uid, row) => {
          await publishNotificationRealtime(row);
        },
      },
      userId,
      type,
      options,
    );
  } catch (err) {
    console.error(`Failed to create notification (${type}):`, err);
    return null;
  }
}

export async function notifyStaffModerationReport(options: {
  actorId: string;
  actorName: string;
  reportId: string;
}): Promise<void> {
  try {
    const staff = await prisma.user.findMany({
      where: {
        role: { in: ["ADMIN", "MODERATOR"] },
        id: { not: options.actorId },
      },
      select: { id: true },
      take: 20,
    });
    await Promise.all(
      staff.map((member) =>
        notify(member.id, "ADMIN_CHAT_REPORT", {
          params: { actorName: options.actorName },
          data: { reportId: options.reportId },
          dedupeKey: `report:${options.reportId}:${member.id}`,
        }),
      ),
    );
  } catch (err) {
    console.error("Failed to notify staff on chat report:", err);
  }
}

export async function listNotificationsForUser(
  userId: string,
  options?: {
    cursor?: string | null;
    limit?: number;
    filter?: "all" | "unread";
  },
): Promise<{
  items: NotificationItemDTO[];
  nextCursor: string | null;
  unreadCount: number;
}> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50);
  const filter = options?.filter === "unread" ? "unread" : "all";

  let cursorRow: { id: string; createdAt: Date } | null = null;
  if (options?.cursor) {
    cursorRow = await prisma.notification.findFirst({
      where: { id: options.cursor, userId },
      select: { id: true, createdAt: true },
    });
  }

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(filter === "unread" ? { readAt: null } : {}),
    ...(cursorRow
      ? {
          OR: [
            { createdAt: { lt: cursorRow.createdAt } },
            { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
          ],
        }
      : {}),
  };

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    }),
    prisma.notification.count({
      where: { userId, readAt: null },
    }),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]!.id : null;

  return {
    items: pageRows.map(toNotificationDTO),
    nextCursor,
    unreadCount,
  };
}

export async function getNotificationSummaryForUser(userId: string): Promise<{
  unreadCount: number;
}> {
  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { unreadCount };
}

export async function getNotificationForUser(
  userId: string,
  notificationId: string,
): Promise<NotificationItemDTO | null> {
  const row = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  return row ? toNotificationDTO(row) : null;
}

export async function setNotificationReadState(
  userId: string,
  notificationId: string,
  read: boolean,
): Promise<{ notification: NotificationItemDTO; unreadCount: number } | null> {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) return null;

  const nextReadAt = read ? existing.readAt ?? new Date() : null;
  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { readAt: nextReadAt },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, readAt: null },
  });

  await publishChange([userChannel(userId)], {
    type: "notifications.changed",
    action: read ? "read" : "unread",
    notificationId: existing.id,
    unreadCount,
  });

  return {
    notification: toNotificationDTO(updated),
    unreadCount,
  };
}

export async function markAllNotificationsRead(userId: string): Promise<{
  updatedCount: number;
  unreadCount: number;
}> {
  const res = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  await publishChange([userChannel(userId)], {
    type: "notifications.changed",
    action: "read_all",
    unreadCount: 0,
  });

  return {
    updatedCount: res.count,
    unreadCount: 0,
  };
}
