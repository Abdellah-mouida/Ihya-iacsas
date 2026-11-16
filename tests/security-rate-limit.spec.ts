import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { checkRateLimit, clearRateLimit } from "../src/lib/rate-limit";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase("Security rate-limiter atomicity & fail-closed tests");

test.describe("IHY-SEC-006: atomic rate limiter & fail-closed behavior", () => {
  test("enforces strict limit under concurrent bursts and fails closed on DB error", async () => {
    const key = `sec-rl-${randomUUID()}`;
    try {
      const limit = 3;
      const results = await Promise.all(
        Array.from({ length: 8 }, () => checkRateLimit(key, limit, 60)),
      );
      const allowedCount = results.filter((r) => r.allowed).length;
      const deniedCount = results.filter((r) => !r.allowed).length;
      expect(allowedCount).toBe(limit);
      expect(deniedCount).toBe(5);

      const dbFailDefault = await checkRateLimit(key, 5, 60, {
        queryRawFn: async () => {
          throw new Error("Simulated DB outage");
        },
      });
      expect(dbFailDefault.allowed).toBe(false);
      expect(dbFailDefault.retryAfter).toBeGreaterThanOrEqual(5);

      const emptyRowDefault = await checkRateLimit(key, 5, 60, {
        queryRawFn: async () => [],
      });
      expect(emptyRowDefault.allowed).toBe(false);
    } finally {
      await clearRateLimit(key);
    }
  });
});
