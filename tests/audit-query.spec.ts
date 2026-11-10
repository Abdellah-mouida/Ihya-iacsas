import { expect, test } from "@playwright/test";

import { buildAdminAuditLogQuery, buildUserAuditLogWhere } from "../src/lib/audit-query";

test("audit query uses an empty Prisma filter when no filters are supplied", () => {
  expect(buildAdminAuditLogQuery()).toEqual({
    filters: { query: "", action: "ALL", from: "", to: "", cursor: null },
    where: {},
  });
});

test("audit query applies each supported admin filter", () => {
  expect(buildAdminAuditLogQuery({ query: "  Layla  " }).where).toEqual({
    AND: [{
      OR: [
        { actorName: { contains: "Layla", mode: "insensitive" } },
        { actorEmail: { contains: "Layla", mode: "insensitive" } },
        { targetName: { contains: "Layla", mode: "insensitive" } },
        { targetEmail: { contains: "Layla", mode: "insensitive" } },
      ],
    }],
  });
  expect(buildAdminAuditLogQuery({ action: "BOOKING_CREATED" }).where).toEqual({
    AND: [{ action: "BOOKING_CREATED" }],
  });
  expect(buildAdminAuditLogQuery({ from: "2026-11-01" }).where).toEqual({
    AND: [{ createdAt: { gte: new Date("2026-11-01T00:00:00.000Z") } }],
  });
  expect(buildAdminAuditLogQuery({ to: "2026-11-01" }).where).toEqual({
    AND: [{ createdAt: { lt: new Date("2026-11-02T00:00:00.000Z") } }],
  });
  expect(buildAdminAuditLogQuery({ cursor: "cm1234567890" })).toMatchObject({
    filters: { cursor: "cm1234567890" },
    where: {},
  });
});

test("ALL is normalized to no action predicate for admin and user activity", () => {
  expect(buildAdminAuditLogQuery({ action: "ALL" }).where).toEqual({});
  expect(buildUserAuditLogWhere("user-123", "ALL")).toEqual({
    AND: [{ OR: [{ targetId: "user-123" }, { actorId: "user-123" }] }],
  });
  expect(buildUserAuditLogWhere("user-123", "BOOKING_CREATED")).toEqual({
    AND: [
      { OR: [{ targetId: "user-123" }, { actorId: "user-123" }] },
      { action: "BOOKING_CREATED" },
    ],
  });
});

test("audit query rejects invalid action, cursor, and date ranges", () => {
  expect(() => buildAdminAuditLogQuery({ action: "all" })).toThrow();
  expect(() => buildAdminAuditLogQuery({ cursor: "bad cursor" })).toThrow();
  expect(() => buildAdminAuditLogQuery({ from: "2026-11-02", to: "2026-11-01" })).toThrow();
  expect(() => buildUserAuditLogWhere("user-123", "not-an-action")).toThrow();
});
