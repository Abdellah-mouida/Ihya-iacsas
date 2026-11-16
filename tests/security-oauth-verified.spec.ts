import { test, expect } from "@playwright/test";
import { isVerifiedGoogleProfile } from "../src/lib/session-sync";

test.describe("Google OAuth email_verified guard", () => {
  test("rejects unverified, missing, or mismatched Google profile email", () => {
    expect(isVerifiedGoogleProfile(undefined, "user@example.test")).toBe(false);
    expect(isVerifiedGoogleProfile({}, "user@example.test")).toBe(false);
    expect(
      isVerifiedGoogleProfile(
        { email_verified: false, email: "user@example.test" },
        "user@example.test",
      ),
    ).toBe(false);
    expect(
      isVerifiedGoogleProfile(
        { email_verified: "true", email: "user@example.test" },
        "user@example.test",
      ),
    ).toBe(false);
    expect(
      isVerifiedGoogleProfile(
        { email_verified: true, email: "other@example.test" },
        "user@example.test",
      ),
    ).toBe(false);
    expect(
      isVerifiedGoogleProfile(
        { email_verified: true, email: "User@Example.Test" },
        "user@example.test",
      ),
    ).toBe(true);
  });
});
