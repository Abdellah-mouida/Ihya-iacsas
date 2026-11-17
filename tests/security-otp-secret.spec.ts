import crypto from "node:crypto";
import { test, expect } from "@playwright/test";
import {
  assertOtpSecretConfigured,
  hashOtp,
  verifyOtpConstantTime,
} from "../src/lib/otp";

test.describe("IHY-SEC-005: OTP_SECRET fail-closed configuration", () => {
  test("fails closed when OTP_SECRET is missing or too short and succeeds when configured", () => {
    const prev = process.env.OTP_SECRET;

    try {
      delete process.env.OTP_SECRET;
      expect(() => assertOtpSecretConfigured()).toThrow(/OTP_SECRET/i);
      expect(() => hashOtp("123456", "user@example.test")).toThrow(/OTP_SECRET/i);

      const legacyFallbackHash = crypto
        .createHmac("sha256", "ihyaa-secure-production-salt-2026")
        .update("user@example.test:123456")
        .digest("hex");
      expect(
        verifyOtpConstantTime("123456", legacyFallbackHash, "user@example.test"),
      ).toBe(false);

      process.env.OTP_SECRET = "too-short";
      expect(() => assertOtpSecretConfigured()).toThrow(/OTP_SECRET/i);
      expect(
        verifyOtpConstantTime("123456", legacyFallbackHash, "user@example.test"),
      ).toBe(false);

      process.env.OTP_SECRET = crypto.randomBytes(32).toString("hex");
      const validHash = hashOtp("654321", "User@Example.test ");
      expect(
        verifyOtpConstantTime("654321", validHash, "user@example.test"),
      ).toBe(true);
      expect(
        verifyOtpConstantTime("000000", validHash, "user@example.test"),
      ).toBe(false);
      expect(
        verifyOtpConstantTime("654321", validHash, "other@example.test"),
      ).toBe(false);
    } finally {
      if (prev === undefined) {
        delete process.env.OTP_SECRET;
      } else {
        process.env.OTP_SECRET = prev;
      }
    }
  });
});
