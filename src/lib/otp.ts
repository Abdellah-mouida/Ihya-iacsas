import crypto from "crypto";

const OTP_SECRET = process.env.OTP_SECRET || "ihyaa-secure-production-salt-2026";

/**
 * Deterministic HMAC-SHA256 OTP hash
 */
export function hashOtp(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
    .digest("hex");
}

/**
 * Constant-time comparison between submitted OTP and stored hash
 */
export function verifyOtpConstantTime(
  submittedOtp: string,
  storedHash: string,
  email: string,
): boolean {
  try {
    const computedHash = hashOtp(submittedOtp, email);
    const submittedBuf = Buffer.from(computedHash, "hex");
    const storedBuf = Buffer.from(storedHash, "hex");

    if (submittedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(submittedBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Generate 6-digit numeric OTP string
 */
export function generateNumericOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
