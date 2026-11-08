import { expect, test } from "@playwright/test";

import {
  decideOnboardingRedirect,
  isOnboardingExemptPath,
  safeOnboardingCallbackUrl,
} from "../src/lib/onboarding-guard";

test.describe("onboarding redirect decision", () => {
  test("does not redirect signed-out or completed users", () => {
    expect(decideOnboardingRedirect({ pathname: "/profile", authenticated: false, onboardingComplete: false })).toBeNull();
    expect(decideOnboardingRedirect({ pathname: "/profile", authenticated: true, onboardingComplete: true })).toBeNull();
  });

  test("redirects an incomplete user and preserves the current path and query", () => {
    expect(decideOnboardingRedirect({
      pathname: "/settings",
      search: "?tab=profile",
      authenticated: true,
      onboardingComplete: false,
    })).toBe("/onboarding?callbackUrl=%2Fsettings%3Ftab%3Dprofile");
  });

  test("allows onboarding, auth, API, sign-out, legal, and static paths", () => {
    const allowedPaths = [
      "/onboarding",
      "/onboarding/continue",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password/token",
      "/verify-email",
      "/api/user/preferences",
      "/api/auth/callback/google",
      "/signout",
      "/sign-out",
      "/terms",
      "/privacy",
      "/_next/static/chunk.js",
      "/images/avatar.webp",
    ];

    for (const pathname of allowedPaths) {
      expect(isOnboardingExemptPath(pathname), pathname).toBe(true);
      expect(decideOnboardingRedirect({ pathname, authenticated: true, onboardingComplete: false }), pathname).toBeNull();
    }
    expect(isOnboardingExemptPath("/profile")).toBe(false);
  });

  test("sends unsafe or looping completion callbacks home", () => {
    expect(safeOnboardingCallbackUrl("/events?open=1")).toBe("/events?open=1");
    expect(safeOnboardingCallbackUrl(null)).toBe("/");
    expect(safeOnboardingCallbackUrl("https://outside.test/" )).toBe("/");
    expect(safeOnboardingCallbackUrl("//outside.test/")).toBe("/");
    expect(safeOnboardingCallbackUrl("/\\outside.test/")).toBe("/");
    expect(safeOnboardingCallbackUrl("/onboarding")).toBe("/");
    expect(safeOnboardingCallbackUrl("/login?callbackUrl=/profile")).toBe("/");
  });
});
