import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  signSessionRotationProof,
  verifySessionRotationProof,
} from "../src/lib/session-sync";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";

assertDevBranchDatabase("Session revocation security regression tests");

test.describe("IHY-SEC-001: Session revocation cannot be bypassed via /api/auth/session", () => {
  test.setTimeout(60_000);

  test("session rotation proof rejects tampering, expiration, wrong user, and version mismatch", () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET || "unit-test-secret-0123456789abcdef";

    const proof = signSessionRotationProof("user-abc", 1, 2, 60_000);
    expect(verifySessionRotationProof(proof, "user-abc", 1, 2)).toBe(true);
    expect(verifySessionRotationProof(proof, "user-xyz", 1, 2)).toBe(false);
    expect(verifySessionRotationProof(proof, "user-abc", 2, 3)).toBe(false);
    expect(verifySessionRotationProof(proof, "user-abc", 1, 3)).toBe(false);
    expect(verifySessionRotationProof(`${proof.slice(0, -1)}0`, "user-abc", 1, 2)).toBe(
      false,
    );

    const expiredProof = signSessionRotationProof("user-abc", 1, 2, -1000);
    expect(verifySessionRotationProof(expiredProof, "user-abc", 1, 2)).toBe(false);
  });

  test("revoked session cannot re-validate via POST /api/auth/session while legitimate password change succeeds", async ({
    browser,
  }) => {
    const user = await createSyntheticUser("Session Revocation Guard");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        city: "الرباط",
        age: 22,
        onboardingCompletedAt: new Date(),
      },
    });

    const ctxActive = await browser.newContext();
    const ctxRevoked = await browser.newContext();

    try {
      const pageActive = await ctxActive.newPage();
      const pageRevoked = await ctxRevoked.newPage();

      // Sign in both contexts with sessionVersion = 1
      for (const p of [pageActive, pageRevoked]) {
        await p.goto("/login?callbackUrl=%2Fprofile", { waitUntil: "load" });
        await p.locator('[data-testid="login-email-input"]').fill(user.email);
        await p.locator('[data-testid="login-password-input"]').fill(user.password);
        await p.locator('[data-testid="login-submit-btn"]').click();
        await p.waitForURL((u) => !u.pathname.startsWith("/login"), {
          timeout: 20_000,
        });
      }

      // Context 1 legitimately changes password -> increments sessionVersion to 2 and stays signed in
      const newPassword = `NextPass-${randomBytes(8).toString("base64url")}!`;
      await pageActive.goto("/change-password", { waitUntil: "load" });
      await pageActive
        .locator('[data-testid="current-password-input"]')
        .fill(user.password);
      await pageActive
        .locator('[data-testid="new-password-input"]')
        .fill(newPassword);
      await pageActive
        .locator('[data-testid="confirm-new-password-input"]')
        .fill(newPassword);
      await pageActive.locator('[data-testid="change-password-submit-btn"]').click();
      await pageActive.waitForURL(/\/(profile|onboarding|events|$)/, {
        timeout: 20_000,
      });

      const activeSessionRes = await pageActive.request.get("/api/auth/session");
      const activeSession = await activeSessionRes.json();
      expect(activeSession?.user?.id).toBe(user.id);

      // Context 2 (revoked cookie, token.sessionVersion = 1) tries to forge sessionVersion = 2
      const csrfRes = await pageRevoked.request.get("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

      await pageRevoked.request.post("/api/auth/session", {
        data: {
          csrfToken,
          data: {
            sessionVersion: 2,
            mustChangePassword: false,
            role: "ADMIN",
          },
        },
      });

      const revokedSessionRes = await pageRevoked.request.get("/api/auth/session");
      const revokedSession = await revokedSessionRes.json();
      expect(revokedSession?.user).toBeUndefined();

      await pageRevoked.goto("/profile", { waitUntil: "load" });
      await expect(pageRevoked).toHaveURL(/\/login/, { timeout: 15_000 });
    } finally {
      await ctxActive.close();
      await ctxRevoked.close();
      await removeSyntheticUser(user.id);
    }
  });
});
