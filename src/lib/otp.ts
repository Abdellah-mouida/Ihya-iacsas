import crypto from "crypto";

const MIN_OTP_SECRET_LENGTH = 16;

export function assertOtpSecretConfigured(): string {
  const secret = process.env.OTP_SECRET?.trim();
  if (!secret || secret.length < MIN_OTP_SECRET_LENGTH) {
    throw new Error(
      `OTP_SECRET environment variable must be set (minimum ${MIN_OTP_SECRET_LENGTH} characters)`,
    );
  }
  return secret;
}

/**
 * Deterministic HMAC-SHA256 OTP hash
 */
export function hashOtp(otp: string, email: string): string {
  const secret = assertOtpSecretConfigured();
  return crypto
    .createHmac("sha256", secret)
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
