import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

test.describe("Booking dead OTP actions removal (IHY-SEC-003)", () => {
  test("unauthenticated booking OTP actions, cross-event deleteMany, and hardcoded OTP secret are removed", () => {
    const actionsSource = readFileSync(
      path.join(process.cwd(), "src/app/actions/bookings.ts"),
      "utf8",
    );
    const serviceSource = readFileSync(
      path.join(process.cwd(), "src/lib/services/bookings.ts"),
      "utf8",
    );
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+requestBookingOtp\b/);
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+verifyBookingOtp\b/);
    expect(actionsSource).not.toMatch(/export\s+async\s+function\s+resendBookingOtp\b/);
    expect(actionsSource).not.toContain("ihyaa-secure-production-salt-2026");
    expect(actionsSource).not.toMatch(/deleteMany\([^)]*confirmed:\s*false/);
    expect(serviceSource).not.toMatch(/deleteMany\([^)]*confirmed:\s*false/);
    expect(serviceSource).toContain('from "@/lib/rate-limit"');
  });

  test("unauthenticated visitor to booking route is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/book", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/login/);
  });
});
