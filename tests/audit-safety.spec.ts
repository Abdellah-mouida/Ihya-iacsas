import { expect, test } from "@playwright/test";

import { sanitizeAuditDetails } from "../src/lib/audit";

test.describe("audit metadata safety", () => {
  test("drops secrets, credentials, request bodies, and nested secret keys", () => {
    expect(
      sanitizeAuditDetails({
        eventId: "event-123",
        password: "never-store",
        otp: "123456",
        accessToken: "never-store",
        requestBody: { profile: "full body" },
        nested: { safe: true, clientSecret: "never-store" },
      }),
    ).toEqual({ eventId: "event-123", nested: { safe: true } });
  });

  test("bounds string, list, object, and nesting sizes", () => {
    const safe = sanitizeAuditDetails({
      value: "x".repeat(800),
      values: Array.from({ length: 40 }, (_, index) => index),
      many: Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`k${index}`, index])),
      tooDeep: { a: { b: { c: { d: { e: "discard" } } } } },
    }) as Record<string, unknown>;

    expect((safe.value as string).length).toBe(500);
    expect((safe.values as unknown[])).toHaveLength(25);
    expect(Object.keys(safe.many as object)).toHaveLength(30);
    expect(safe.tooDeep).toEqual({ a: { b: { c: {} } } });
  });
});
