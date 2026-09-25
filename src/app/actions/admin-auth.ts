"use server";

/**
 * Temporary Admin Authentication Server Actions
 *
 * NOTE: STOPGAP ACCESS GATE
 * This is a lightweight access control mechanism protecting /admin routes
 * with a single shared password (ADMIN_PASSWORD), timing-safe verification,
 * and rate-limiting. A complete multi-user authentication system (e.g. NextAuth)
 * should replace this in production.
 */

import crypto from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ADMIN_COOKIE_NAME, signAdminSessionToken } from "@/lib/admin-token";
import { prisma } from "@/lib/prisma";

const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes lockout

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headerList.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Constant-time comparison between submitted password and configured ADMIN_PASSWORD
 * Never logs or exposes password strings.
 */
function verifyPasswordConstantTime(submitted: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !submitted) return false;

  // SHA-256 pre-hash guarantees equal-length 32-byte buffers
  const submittedHash = crypto.createHash("sha256").update(submitted).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();

  return crypto.timingSafeEqual(submittedHash, expectedHash);
}

/**
 * Checks if the client IP is currently locked out from admin login attempts.
 */
async function checkLoginLockout(ip: string): Promise<{ locked: boolean; retryAfter?: number }> {
  try {
    const key = `admin_login_fail:${ip}`;
    const now = new Date();
    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!record || record.expiresAt < now) {
      return { locked: false };
    }

    if (record.count >= MAX_LOGIN_FAILURES) {
      const remainingMinutes = Math.ceil(
        (record.expiresAt.getTime() - now.getTime()) / 60000,
      );
      return { locked: true, retryAfter: Math.max(1, remainingMinutes) };
    }

    return { locked: false };
  } catch {
    return { locked: false };
  }
}

/**
 * Records a failed login attempt for the client IP.
 */
async function recordLoginFailure(ip: string): Promise<void> {
  try {
    const key = `admin_login_fail:${ip}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + LOCKOUT_WINDOW_SECONDS * 1000);

    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!record || record.expiresAt < now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
    } else {
      await prisma.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
    }
  } catch {
    // Graceful fallback if database rate limiting is temporarily unavailable
  }
}

/**
 * Resets the failed attempts counter after a successful login.
 */
async function resetLoginFailures(ip: string): Promise<void> {
  try {
    const key = `admin_login_fail:${ip}`;
    await prisma.rateLimit.deleteMany({
      where: { key },
    });
  } catch {
    // Ignore error
  }
}

/**
 * Authenticates the admin user and sets an HttpOnly session cookie.
 */
export async function adminLogin(password: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const ip = await getClientIp();

  // 1. Check brute-force lockout
  const lockout = await checkLoginLockout(ip);
  if (lockout.locked) {
    return {
      success: false,
      error: `Too many failed login attempts. Account locked. Please try again in ${lockout.retryAfter || 15} minutes.`,
    };
  }

  // 2. Validate password in constant time
  const isValid = verifyPasswordConstantTime(password);
  if (!isValid) {
    await recordLoginFailure(ip);
    return {
      success: false,
      error: "Invalid password. Access denied.",
    };
  }

  // 3. Successful login - clear failures and issue session cookie
  await resetLoginFailures(ip);
  const token = await signAdminSessionToken();

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Session cookie: no maxAge or expires set so it's discarded on browser close
  });

  return { success: true };
}

/**
 * Logs out the admin user and redirects to the login screen.
 */
export async function adminLogout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
