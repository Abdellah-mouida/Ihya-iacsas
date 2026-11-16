import { test, expect } from "@playwright/test";
import enMessages from "../locales/en.json";
import arMessages from "../locales/ar.json";
import { notifyWithDeps, type NotifyDeps } from "../src/lib/notifications";
import {
  formatOfflineSummaryMessage,
  resolveNotificationDisplay,
  resolveNotificationTargetUrl,
  sanitizeNotificationRecordFields,
} from "../src/lib/notifications-shared";
import type { RealtimeEvent } from "../src/lib/chat/realtime/types";

function getTranslator(dict: Record<string, unknown>) {
  return (key: string, params?: Record<string, string | number>) => {
    const parts = key.split(".");
    let val: unknown = dict;
    for (const part of parts) {
      if (val && typeof val === "object" && part in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    let out = typeof val === "string" ? val : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        out = out.replaceAll(`{${k}}`, String(v));
      }
    }
    return out;
  };
}

test.describe("13-T6: Notification helper unit tests", () => {
  test("sanitizeNotificationRecordFields strips control chars and drops private/sensitive keys", () => {
    const sanitized = sanitizeNotificationRecordFields({
      actorName: "  Amina\u0000\nB  ",
      roomName: "Study Circle",
      text: "Secret message body",
      ciphertext: "abc",
      password: "secret",
      email: "user@example.com",
      count: 3,
      ok: true,
    });

    expect(sanitized).toEqual({
      actorName: "Amina  B",
      roomName: "Study Circle",
      count: 3,
      ok: true,
    });
  });

  test("resolveNotificationTargetUrl blocks unsafe paths and builds valid relative targets", () => {
    expect(resolveNotificationTargetUrl({ type: "BOOKING_APPROVED" })).toBe(
      "/profile#bookings",
    );
    expect(
      resolveNotificationTargetUrl({
        type: "ROOM_INVITE_RECEIVED",
        data: { conversationId: "conv_123" },
      }),
    ).toBe("/messages?tab=friends&c=conv_123");
    expect(
      resolveNotificationTargetUrl({
        type: "ROOM_INVITE_RECEIVED",
        data: { conversationId: "../bad/path" },
      }),
    ).toBe("/messages?tab=rooms");
    expect(
      resolveNotificationTargetUrl({
        type: "FRIEND_REQUEST_ACCEPTED",
        data: { actorId: "usr_1" },
      }),
    ).toBe("/messages?tab=friends&dm=usr_1");
  });

  test("resolveNotificationDisplay localizes event titles and actor params in ar and en", () => {
    const tEn = getTranslator(enMessages as Record<string, unknown>);
    const tAr = getTranslator(arMessages as Record<string, unknown>);

    const displayEn = resolveNotificationDisplay(
      {
        id: "n1",
        type: "BOOKING_WAITLIST_PROMOTED",
        i18nKey: "notifications.types.BOOKING_WAITLIST_PROMOTED",
        params: {
          eventTitleAr: "مخيم الربيع",
          eventTitleEn: "Spring Camp",
          slug: "spring-camp",
        },
        data: { slug: "spring-camp" },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      tEn,
      "en",
    );
    expect(displayEn.title.toLowerCase()).toContain("spot opened");
    expect(displayEn.body).toContain("Spring Camp");
    expect(displayEn.targetUrl).toBe("/profile#bookings");

    const displayAr = resolveNotificationDisplay(
      {
        id: "n2",
        type: "BOOKING_APPROVED",
        i18nKey: "notifications.types.BOOKING_APPROVED",
        params: {
          eventTitleAr: "مخيم الربيع",
          eventTitleEn: "Spring Camp",
          slug: "spring-camp",
        },
        data: { slug: "spring-camp" },
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      tAr,
      "ar",
    );
    expect(displayAr.body).toContain("مخيم الربيع");
  });

  test("formatOfflineSummaryMessage handles English and Arabic plural forms", () => {
    const tEn = getTranslator(enMessages as Record<string, unknown>);
    const tAr = getTranslator(arMessages as Record<string, unknown>);

    expect(formatOfflineSummaryMessage(1, tEn, "en")).toBe("You have 1 new notification");
    expect(formatOfflineSummaryMessage(4, tEn, "en")).toBe("You have 4 new notifications");

    expect(formatOfflineSummaryMessage(1, tAr, "ar")).toContain("واحد");
    expect(formatOfflineSummaryMessage(2, tAr, "ar")).toContain("إشعاران");
    expect(formatOfflineSummaryMessage(5, tAr, "ar")).toContain("5");
    expect(formatOfflineSummaryMessage(12, tAr, "ar")).toContain("12");
  });

  test("notifyWithDeps deduplicates within window, rate-limits, and emits signal-only realtime event", async () => {
    const stored: Array<{
      id: string;
      userId: string;
      type: string;
      i18nKey: string;
      params: unknown;
      data: unknown;
      dedupeKey: string | null;
      readAt: Date | null;
      createdAt: Date;
    }> = [];
    const published: Array<{ channel: string; event: RealtimeEvent }> = [];
    let seq = 0;

    const deps: NotifyDeps = {
      db: {
        notification: {
          findFirst: async ({ where }) => {
            const hit = stored.find(
              (row) =>
                row.userId === where.userId &&
                row.dedupeKey === where.dedupeKey &&
                row.createdAt >= where.createdAt.gte,
            );
            return hit ? { id: hit.id } : null;
          },
          count: async ({ where }) =>
            stored.filter(
              (row) =>
                row.userId === where.userId &&
                row.type === where.type &&
                row.createdAt >= where.createdAt.gte,
            ).length,
          create: async ({ data }) => {
            seq += 1;
            const row = {
              id: `notif_${seq}`,
              userId: data.userId,
              type: data.type,
              i18nKey: data.i18nKey,
              params: data.params,
              data: data.data,
              dedupeKey: data.dedupeKey ?? null,
              readAt: null,
              createdAt: new Date(),
            };
            stored.push(row);
            return row;
          },
        },
      },
      publish: async (userId, row) => {
        published.push({
          channel: `user:${userId}`,
          event: {
            type: "notification.created",
            notificationId: row.id,
            notificationType: row.type,
            createdAt: row.createdAt.toISOString(),
          },
        });
      },
    };

    const first = await notifyWithDeps(deps, "user_1", "FRIEND_REQUEST_RECEIVED", {
      dedupeKey: "friend:u2:u1",
      params: { actorId: "u2", actorName: "Youssef", text: "must-be-stripped" },
      data: { actorId: "u2" },
    });
    expect(first).not.toBeNull();
    expect(first?.id).toBe("notif_1");
    expect(first?.params).toEqual({ actorId: "u2", actorName: "Youssef" });
    expect(published).toHaveLength(1);
    expect(published[0].channel).toBe("user:user_1");
    expect(published[0].event).toMatchObject({
      type: "notification.created",
      notificationId: "notif_1",
      notificationType: "FRIEND_REQUEST_RECEIVED",
    });
    expect(JSON.stringify(published[0].event)).not.toContain("Youssef");
    expect(JSON.stringify(published[0].event)).not.toContain("must-be-stripped");

    // Duplicate within dedupe window is skipped
    const dup = await notifyWithDeps(deps, "user_1", "FRIEND_REQUEST_RECEIVED", {
      dedupeKey: "friend:u2:u1",
      params: { actorName: "Youssef" },
    });
    expect(dup).toBeNull();
    expect(stored).toHaveLength(1);

    // Rate limit enforcement (FRIEND_REQUEST_RECEIVED max is 15)
    for (let i = 0; i < 14; i++) {
      const res = await notifyWithDeps(deps, "user_1", "FRIEND_REQUEST_RECEIVED", {
        dedupeKey: `friend:other_${i}:u1`,
      });
      expect(res).not.toBeNull();
    }
    const rateLimited = await notifyWithDeps(deps, "user_1", "FRIEND_REQUEST_RECEIVED", {
      dedupeKey: "friend:overflow:u1",
    });
    expect(rateLimited).toBeNull();
  });
});
