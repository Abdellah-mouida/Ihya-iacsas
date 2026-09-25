/**
 * Temporary Admin Access Gate - Session Token Handling
 *
 * NOTE: This is explicitly a STOPGAP MEASURE for /admin access control.
 * Uses standard Web Crypto API (crypto.subtle) so it is fully isomorphic
 * and safe to run in Next.js Edge middleware as well as Node.js server runtimes.
 */

export const ADMIN_COOKIE_NAME = "ihyaa_admin_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours safety cap

function getAuthSecret(): string {
  return (
    process.env.OTP_SECRET ||
    process.env.ADMIN_PASSWORD ||
    "ihyaa-temporary-auth-salt-2026"
  );
}

/**
 * Generates an HMAC-SHA256 signed session token.
 */
export async function signAdminSessionToken(): Promise<string> {
  const encoder = new TextEncoder();
  const secret = getAuthSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const timestamp = Date.now().toString();
  const nonce =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
  const payload = `${timestamp}.${nonce}`;

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${payload}.${signatureHex}`;
}

/**
 * Validates an HMAC-SHA256 session token using Web Crypto constant-time verification.
 */
export async function verifyAdminSessionToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, signatureHex] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (
    isNaN(timestamp) ||
    Date.now() - timestamp > SESSION_MAX_AGE_MS ||
    timestamp > Date.now() + 60000
  ) {
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const secret = getAuthSecret();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const payload = `${timestampStr}.${nonce}`;
    const sigBytes = new Uint8Array(
      (signatureHex.match(/.{1,2}/g) || []).map((b) => parseInt(b, 16)),
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(payload),
    );
  } catch {
    return false;
  }
}
