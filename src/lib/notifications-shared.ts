export const NOTIFICATION_TYPES = [
  "BOOKING_APPROVED",
  "BOOKING_REJECTED",
  "BOOKING_WAITLIST_PROMOTED",
  "FRIEND_REQUEST_RECEIVED",
  "FRIEND_REQUEST_ACCEPTED",
  "ROOM_INVITE_RECEIVED",
  "ADMIN_ROLE_CHANGED",
  "CHAT_MODERATION_ACTION",
  "ADMIN_CHAT_REPORT",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationIconName =
  | "calendar-check"
  | "calendar-x"
  | "sparkles"
  | "user-plus"
  | "user-check"
  | "door-open"
  | "shield"
  | "alert-triangle";

export type NotificationPrimitive = string | number | boolean;
export type NotificationParamMap = Record<string, NotificationPrimitive>;

export interface NotificationItemDTO {
  id: string;
  type: string;
  i18nKey: string;
  params: NotificationParamMap;
  data: NotificationParamMap;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDefinition {
  type: NotificationType;
  icon: NotificationIconName;
  titleKey: string;
  bodyKey: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  dedupeWindowMs: number;
  resolveTargetUrl: (
    data: NotificationParamMap,
    params: NotificationParamMap,
  ) => string;
}

const FORBIDDEN_PARAM_KEYS = new Set([
  "text",
  "body",
  "content",
  "ciphertext",
  "message",
  "password",
  "token",
  "secret",
  "email",
  "phone",
]);

function safeRelativePath(path: string, fallback = "/notifications"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  return path;
}

function asId(val: NotificationPrimitive | undefined): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export const NOTIFICATION_REGISTRY: Record<
  NotificationType,
  NotificationDefinition
> = {
  BOOKING_APPROVED: {
    type: "BOOKING_APPROVED",
    icon: "calendar-check",
    titleKey: "notifications.types.BOOKING_APPROVED.title",
    bodyKey: "notifications.types.BOOKING_APPROVED.body",
    rateLimitWindowMs: 0,
    rateLimitMax: 0,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: () => "/profile#bookings",
  },
  BOOKING_REJECTED: {
    type: "BOOKING_REJECTED",
    icon: "calendar-x",
    titleKey: "notifications.types.BOOKING_REJECTED.title",
    bodyKey: "notifications.types.BOOKING_REJECTED.body",
    rateLimitWindowMs: 0,
    rateLimitMax: 0,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: () => "/profile#bookings",
  },
  BOOKING_WAITLIST_PROMOTED: {
    type: "BOOKING_WAITLIST_PROMOTED",
    icon: "sparkles",
    titleKey: "notifications.types.BOOKING_WAITLIST_PROMOTED.title",
    bodyKey: "notifications.types.BOOKING_WAITLIST_PROMOTED.body",
    rateLimitWindowMs: 0,
    rateLimitMax: 0,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: () => "/profile#bookings",
  },
  FRIEND_REQUEST_RECEIVED: {
    type: "FRIEND_REQUEST_RECEIVED",
    icon: "user-plus",
    titleKey: "notifications.types.FRIEND_REQUEST_RECEIVED.title",
    bodyKey: "notifications.types.FRIEND_REQUEST_RECEIVED.body",
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 15,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: () => "/messages?tab=friends&requests=1",
  },
  FRIEND_REQUEST_ACCEPTED: {
    type: "FRIEND_REQUEST_ACCEPTED",
    icon: "user-check",
    titleKey: "notifications.types.FRIEND_REQUEST_ACCEPTED.title",
    bodyKey: "notifications.types.FRIEND_REQUEST_ACCEPTED.body",
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 20,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: (data) => {
      const actorId = asId(data.actorId);
      return actorId
        ? safeRelativePath(`/messages?tab=friends&dm=${actorId}`)
        : "/messages?tab=friends";
    },
  },
  ROOM_INVITE_RECEIVED: {
    type: "ROOM_INVITE_RECEIVED",
    icon: "door-open",
    titleKey: "notifications.types.ROOM_INVITE_RECEIVED.title",
    bodyKey: "notifications.types.ROOM_INVITE_RECEIVED.body",
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 20,
    dedupeWindowMs: 24 * 60 * 60 * 1000,
    resolveTargetUrl: (data) => {
      const conversationId = asId(data.conversationId);
      if (conversationId) {
        return safeRelativePath(`/messages?tab=friends&c=${conversationId}`);
      }
      const actorId = asId(data.actorId);
      return actorId
        ? safeRelativePath(`/messages?tab=friends&dm=${actorId}`)
        : "/messages?tab=rooms";
    },
  },
  ADMIN_ROLE_CHANGED: {
    type: "ADMIN_ROLE_CHANGED",
    icon: "shield",
    titleKey: "notifications.types.ADMIN_ROLE_CHANGED.title",
    bodyKey: "notifications.types.ADMIN_ROLE_CHANGED.body",
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 10,
    dedupeWindowMs: 5 * 60 * 1000,
    resolveTargetUrl: () => "/profile",
  },
  CHAT_MODERATION_ACTION: {
    type: "CHAT_MODERATION_ACTION",
    icon: "alert-triangle",
    titleKey: "notifications.types.CHAT_MODERATION_ACTION.title",
    bodyKey: "notifications.types.CHAT_MODERATION_ACTION.body",
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 10,
    dedupeWindowMs: 60 * 1000,
    resolveTargetUrl: () => "/chat",
  },
  ADMIN_CHAT_REPORT: {
    type: "ADMIN_CHAT_REPORT",
    icon: "alert-triangle",
    titleKey: "notifications.types.ADMIN_CHAT_REPORT.title",
    bodyKey: "notifications.types.ADMIN_CHAT_REPORT.body",
    rateLimitWindowMs: 60 * 1000,
    rateLimitMax: 10,
    dedupeWindowMs: 60 * 60 * 1000,
    resolveTargetUrl: () => "/admin/moderation",
  },
};

export function isKnownNotificationType(
  type: string,
): type is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function getNotificationDefinition(
  type: string,
): NotificationDefinition | null {
  if (!isKnownNotificationType(type)) return null;
  return NOTIFICATION_REGISTRY[type];
}

export function sanitizeNotificationRecordFields(
  input?: Record<string, string | number | boolean | null | undefined> | null,
): NotificationParamMap {
  if (!input || typeof input !== "object") return {};
  const result: NotificationParamMap = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key || key.length > 64) continue;
    if (FORBIDDEN_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
      if (cleaned) {
        result[key] = cleaned.slice(0, 140);
      }
    } else if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = value;
    } else if (typeof value === "boolean") {
      result[key] = value;
    }
  }
  return result;
}

export function interpolateNotificationTemplate(
  template: string,
  params: NotificationParamMap,
  locale: "ar" | "en",
): string {
  const eventTitle =
    locale === "ar"
      ? (params.eventTitleAr ?? params.eventTitleEn ?? params.eventTitle ?? "")
      : (params.eventTitleEn ?? params.eventTitleAr ?? params.eventTitle ?? "");

  const merged: Record<string, string | number | boolean> = {
    ...params,
    eventTitle,
  };

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const val = merged[key];
    return val === undefined || val === null ? "" : String(val);
  });
}

export function resolveNotificationTargetUrl(item: {
  type: string;
  data?: NotificationParamMap;
  params?: NotificationParamMap;
}): string {
  const def = getNotificationDefinition(item.type);
  if (!def) return "/notifications";
  return safeRelativePath(
    def.resolveTargetUrl(item.data ?? {}, item.params ?? {}),
  );
}

export function resolveNotificationDisplay(
  item: NotificationItemDTO,
  t: (key: string) => string,
  locale: "ar" | "en",
): {
  title: string;
  body: string;
  targetUrl: string;
  icon: NotificationIconName;
} {
  const def = getNotificationDefinition(item.type);
  const titleKey = def?.titleKey ?? `${item.i18nKey}.title`;
  const bodyKey = def?.bodyKey ?? `${item.i18nKey}.body`;

  const rawTitle = t(titleKey);
  const rawBody = t(bodyKey);

  return {
    title: interpolateNotificationTemplate(rawTitle, item.params, locale),
    body: interpolateNotificationTemplate(rawBody, item.params, locale),
    targetUrl: resolveNotificationTargetUrl(item),
    icon: def?.icon ?? "sparkles",
  };
}

export function formatOfflineSummaryMessage(
  unreadCount: number,
  t: (key: string, params?: Record<string, string | number>) => string,
  locale: "ar" | "en",
): string {
  if (locale === "ar") {
    if (unreadCount === 1) return t("notifications.summaryOne");
    if (unreadCount === 2) return t("notifications.summaryTwo");
    if (unreadCount >= 3 && unreadCount <= 10) {
      return t("notifications.summaryFew", { count: unreadCount });
    }
    return t("notifications.summaryMany", { count: unreadCount });
  }
  return unreadCount === 1
    ? t("notifications.summaryOne")
    : t("notifications.summaryMany", { count: unreadCount });
}
