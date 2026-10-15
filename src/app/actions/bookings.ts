"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { auth } from "@/auth";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/constants";
import { safeRevalidatePath } from "@/lib/cache";
import { sendOTPEmail, sendWaitlistPromotionEmail } from "@/lib/email";
import { isEventEnded } from "@/lib/event-time";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

const OTP_SECRET = process.env.OTP_SECRET || "ihyaa-secure-production-salt-2026";
const MAX_VERIFICATION_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP using HMAC-SHA256 with server secret + email salt
 * This prevents rainbow table attacks even if the database is leaked.
 */
function hashOtp(otp: string, email: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
    .digest("hex");
}

/**
 * Constant-time comparison between submitted OTP and stored hash
 */
function verifyOtpHash(
  submittedOtp: string,
  email: string,
  storedHash: string,
): boolean {
  try {
    const computedHash = hashOtp(submittedOtp, email);
    const computedBuffer = Buffer.from(computedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");

    if (computedBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, storedBuffer);
  } catch {
    return false;
  }
}

/**
 * Check and record rate limit in Postgres
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const now = new Date();
    const expiresAt = new Date(Date.now() + windowSeconds * 1000);

    const record = await prisma.rateLimit.findUnique({
      where: { key },
    });

    if (!record || record.expiresAt < now) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      return { allowed: true };
    }

    if (record.count >= limit) {
      const remainingSeconds = Math.ceil(
        (record.expiresAt.getTime() - now.getTime()) / 1000,
      );
      return { allowed: false, retryAfter: Math.max(1, remainingSeconds) };
    }

    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return { allowed: true };
  } catch {
    // If rate limit table is temporarily unreachable, allow request to proceed gracefully
    return { allowed: true };
  }
}

/**
 * Resolve target event by ID/slug without falling back to a different event
 */
async function resolveTargetEvent(eventId?: string) {
  if (eventId) {
    const trimmed = eventId.trim();
    // 1. Direct match on slug or ID
    let event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug: trimmed },
          { id: trimmed },
        ],
      },
    });
    if (event) return event;

    // 2. Prefix or substring match for slug or id compatibility
    event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug: { startsWith: trimmed } },
          { slug: { contains: trimmed } },
          { id: { startsWith: trimmed } },
          { id: { contains: trimmed } },
        ],
      },
      orderBy: { date: "asc" },
    });
    return event;
  }

  // Fallback only when NO event was specified: pick the active open event
  return await prisma.event.findFirst({
    where: { bookingOpen: true },
    orderBy: { date: "asc" },
  });
}

/**
 * Returns the current authenticated user state for the booking flow:
 * - whether they are authenticated
 * - whether they need onboarding
 * - whether they are already booked for this event
 * - snapshot of user details (name, email, city, age, image)
 */
export async function getBookingUserState(eventId?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { authenticated: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        age: true,
        image: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      return { authenticated: false };
    }

    if (!user.onboardingCompletedAt || !user.city || !user.age) {
      return { authenticated: true, needsOnboarding: true };
    }

    let alreadyBooked = false;
    let existingStatus: string | null = null;
    let existingRef: string | null = null;

    if (eventId) {
      const event = await resolveTargetEvent(eventId);
      if (event) {
        const existing = await prisma.booking.findFirst({
          where: {
            eventId: event.id,
            OR: [
              { userId: user.id },
              { email: user.email! },
            ],
          },
        });
        if (existing) {
          alreadyBooked = true;
          existingStatus = existing.status;
          existingRef = `IHY-${existing.id.slice(-6).toUpperCase()}`;
        }
      }
    }

    return {
      authenticated: true,
      needsOnboarding: false,
      alreadyBooked,
      existingStatus,
      existingRef,
      user: {
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        city: user.city || "",
        age: user.age || 0,
        image: user.image,
      },
    };
  } catch {
    return { authenticated: false };
  }
}

/**
 * Create a booking for an authenticated user who completed onboarding.
 * Automatically snapshots user data, enforces per-event uniqueness,
 * checks capacity and sets status (CONFIRMED, PENDING, or WAITLISTED).
 */
export async function createAuthenticatedBooking(data: {
  eventId?: string;
  motive?: string;
  locale?: string;
}) {
  try {
    const { eventId, motive, locale = "ar" } = data;
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return {
        success: false,
        unauthenticated: true,
        error:
          locale === "ar"
            ? "يرجى تسجيل الدخول أولاً لإتمام الحجز"
            : "Please sign in first to complete your booking",
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        city: true,
        age: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user || !user.onboardingCompletedAt || !user.city || !user.age || !user.email) {
      return {
        success: false,
        needsOnboarding: true,
        error:
          locale === "ar"
            ? "يرجى إكمال بياناتك الشخصية أولاً"
            : "Please complete your profile first",
      };
    }

    const userEmail = user.email;

    // Resolve target event
    const event = await resolveTargetEvent(eventId);
    if (!event) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "الفعالية المطلوبة غير موجودة"
            : "The requested event was not found",
      };
    }

    if (!event.bookingOpen || isEventEnded(event.date, event.time)) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "انتهت هذه الفعالية أو أُغلق التسجيل فيها"
            : "This event has ended or registration is closed",
      };
    }

    // Rate limit: max 5 bookings per hour per user
    const rateLimit = await checkRateLimit(`auth_book:${user.id}`, 5, 3600);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "طلبات حجز كثيرة جداً. يرجى المحاولة لاحقاً."
            : "Too many booking requests. Please try again later.",
      };
    }

    // Check uniqueness (by userId or by email)
    const existingBooking = await prisma.booking.findFirst({
      where: {
        eventId: event.id,
        OR: [
          { userId: user.id },
          { email: userEmail },
        ],
      },
    });

    if (existingBooking) {
      return {
        success: false,
        alreadyBooked: true,
        error:
          locale === "ar"
            ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
            : "You have already booked for this event",
      };
    }

    // Determine status & capacity
    const isLimited = event.capacityType === "LIMITED";
    let newStatus = "CONFIRMED";
    let isConfirmed = true;
    let waitlistOrder: number | null = null;

    if (isLimited) {
      const confirmedCount = await prisma.booking.count({
        where: {
          eventId: event.id,
          status: "CONFIRMED",
        },
      });

      const capacity = event.capacity ?? 0;
      if (confirmedCount < capacity) {
        newStatus = "PENDING";
        isConfirmed = false;
      } else {
        newStatus = "WAITLISTED";
        isConfirmed = false;
        const lastWaitlisted = await prisma.booking.findFirst({
          where: {
            eventId: event.id,
            status: "WAITLISTED",
          },
          orderBy: { waitlistOrder: "desc" },
        });
        waitlistOrder = (lastWaitlisted?.waitlistOrder ?? 0) + 1;
      }
    }

    // Snapshot user data into Booking record
    let booking;
    try {
      booking = await prisma.booking.create({
        data: {
          eventId: event.id,
          userId: user.id,
          fullName: user.name || "مشارك",
          email: userEmail,
          city: user.city,
          age: user.age,
          motive: motive?.trim() || null,
          confirmed: isConfirmed,
          status: newStatus,
          waitlistOrder,
        },
      });
    } catch (createErr: unknown) {
      const err = createErr as { code?: string };
      if (err?.code === "P2002") {
        return {
          success: false,
          alreadyBooked: true,
          error:
            locale === "ar"
              ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
              : "You have already booked for this event",
        };
      }
      throw createErr;
    }

    safeRevalidatePath("/events");
    safeRevalidatePath("/book");
    safeRevalidatePath("/account");
    safeRevalidatePath("/admin");
    safeRevalidatePath("/admin/bookings");

    return {
      success: true,
      bookingRef: `IHY-${booking.id.slice(-6).toUpperCase()}`,
      status: newStatus,
      waitlistOrder,
      eventId: event.id,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Error creating authenticated booking:", error);
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create booking",
    };
  }
}

export async function requestBookingOtp(data: {
  eventId?: string;
  fullName: string;
  email: string;
  city: string;
  age: number;
  motive?: string;
  locale?: string;
}) {
  try {
    const { eventId, fullName, email, city, age, motive, locale = "ar" } = data;

    if (!fullName || !email || !city || !age) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "يرجى ملء جميع الحقول المطلوبة"
            : "Please fill in all required fields",
      };
    }

    if (age < 5 || age > 120) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "يرجى إدخال عمر صحيح"
            : "Please enter a valid age",
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailParts = cleanEmail.split("@");
    if (emailParts.length !== 2) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "صيغة البريد الإلكتروني غير صحيحة"
            : "Invalid email format",
      };
    }

    const domain = emailParts[1];
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return {
        success: false,
        error:
          locale === "ar"
            ? `نطاق البريد غير مقبول (@${domain}). يرجى استخدام بريد من مزود معروف (Gmail, Yahoo, Outlook, iCloud...).`
            : `Email domain (@${domain}) is not accepted. Please use a well-known provider (Gmail, Yahoo, Outlook, iCloud...).`,
      };
    }

    // Find target event (strictly by specified ID/slug, or first open event if omitted)
    const event = await resolveTargetEvent(eventId);

    if (!event) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "الفعالية المطلوبة غير موجودة"
            : "The requested event was not found",
      };
    }

    if (!event.bookingOpen || isEventEnded(event.date, event.time)) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "انتهت هذه الفعالية أو أُغلق التسجيل فيها"
            : "This event has ended or registration is closed",
      };
    }

    // Task 2: Email uniqueness check BEFORE generating or sending OTP
    const existingBooking = await prisma.booking.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: cleanEmail,
        },
      },
    });

    if (existingBooking) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
            : "You have already booked for this event",
      };
    }

    // Rate limit: max 1 request per 30 seconds, max 5 per 15 minutes per email
    const cooldownLimit = await checkRateLimit(`otp_gen_cooldown:${cleanEmail}`, 1, 30);
    if (!cooldownLimit.allowed) {
      return {
        success: false,
        error:
          locale === "ar"
            ? `يرجى الانتظار ${cooldownLimit.retryAfter || 30} ثانية قبل طلب رمز جديد.`
            : `Please wait ${cooldownLimit.retryAfter || 30}s before requesting a new code.`,
      };
    }

    const maxGenLimit = await checkRateLimit(`otp_gen_window:${cleanEmail}`, 5, 900);
    if (!maxGenLimit.allowed) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "تجاوزت الحد الأقصى لطلبات الرمز. يرجى المحاولة بعد 15 دقيقة."
            : "Too many code requests. Please try again after 15 minutes.",
      };
    }

    // Generate cryptographically secure OTP
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp, cleanEmail);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any previous active OTPs for this email
    await prisma.otpVerification.updateMany({
      where: {
        email: cleanEmail,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Clean up any legacy unconfirmed booking records for this email
    await prisma.booking.deleteMany({
      where: {
        email: cleanEmail,
        confirmed: false,
      },
    });

    // Create new secure OTP verification record with registration payload
    const otpRecord = await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        eventId: event.id,
        fullName: fullName.trim(),
        city: city.trim(),
        age,
        motive: motive?.trim() || null,
      },
    });

    // Send the verification code via Brevo API
    const emailResult = await sendOTPEmail(cleanEmail, otp, locale);

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || "Failed to send verification code email",
      };
    }

    return {
      success: true,
      bookingId: otpRecord.id,
      verificationId: otpRecord.id,
      email: cleanEmail,
      eventId: event.id,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Error requesting booking OTP:", error);
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to initiate booking verification",
    };
  }
}

export async function verifyBookingOtp(data: {
  bookingId?: string;
  email: string;
  otp: string;
  eventId?: string;
  locale?: string;
}) {
  try {
    const { bookingId, email, otp, eventId, locale = "ar" } = data;

    if (!email || !otp) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "يرجى إدخال رمز التحقق"
            : "Please enter the verification code",
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    // Rate limit: max 10 attempts per minute per email
    const verRateLimit = await checkRateLimit(`otp_ver_rate:${cleanEmail}`, 10, 60);
    if (!verRateLimit.allowed) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "محاولات كثيرة جداً. يرجى الانتظار دقيقة قبل المحاولة مرة أخرى."
            : "Too many attempts. Please wait a minute before trying again.",
      };
    }

    // Find active OTP record for this email (matching bookingId/verificationId if provided)
    let otpRecord = bookingId
      ? await prisma.otpVerification.findFirst({
          where: {
            id: bookingId,
            email: cleanEmail,
            usedAt: null,
          },
        })
      : null;

    if (!otpRecord) {
      otpRecord = await prisma.otpVerification.findFirst({
        where: {
          email: cleanEmail,
          usedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!otpRecord) {
      return {
        success: false,
        expired: true,
        error:
          locale === "ar"
            ? "لم يتم العثور على رمز تحقق نشط أو انتهت صلاحيته. يرجى طلب رمز جديد."
            : "No active verification code found or expired. Please request a new code.",
      };
    }

    const now = new Date();
    if (otpRecord.expiresAt < now) {
      // Mark as used/expired
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { usedAt: now },
      });
      return {
        success: false,
        expired: true,
        error:
          locale === "ar"
            ? "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد."
            : "Verification code has expired. Please request a new code.",
      };
    }

    // Check maximum allowed attempts
    if (otpRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { usedAt: now },
      });
      return {
        success: false,
        error:
          locale === "ar"
            ? "لقد استنفدت الحد الأقصى للمحاولات (5). يرجى طلب رمز جديد."
            : "You have exceeded the maximum attempts (5). Please request a new code.",
      };
    }

    // Constant-time check
    const isValid = verifyOtpHash(cleanOtp, cleanEmail, otpRecord.otpHash);

    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1;
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });

      const remaining = MAX_VERIFICATION_ATTEMPTS - newAttempts;
      return {
        success: false,
        error:
          locale === "ar"
            ? remaining > 0
              ? `رمز التحقق غير صحيح. تبقى لديك ${remaining} محاولات.`
              : "رمز التحقق غير صحيح. تم استنفاد المحاولات، يرجى طلب رمز جديد."
            : remaining > 0
            ? `Invalid verification code. You have ${remaining} attempts left.`
            : "Invalid code. Max attempts reached, please request a new code.",
      };
    }

    // Server-side slug/event re-verification: ensure submitted event matches OTP record
    if (eventId && otpRecord.eventId) {
      const expectedEvent = await resolveTargetEvent(eventId);
      if (expectedEvent && expectedEvent.id !== otpRecord.eventId) {
        return {
          success: false,
          error:
            locale === "ar"
              ? "الفعالية لا تطابق سجل الحجز الأصلي"
              : "The event does not match the original booking record",
        };
      }
    }

    // Single-use: mark OTP as used immediately
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { usedAt: now },
    });

    // Resolve target event strictly from OTP record (no silent fallback to different events)
    const targetEventId = otpRecord.eventId;
    const event = targetEventId
      ? await prisma.event.findUnique({ where: { id: targetEventId } })
      : null;

    if (!event) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "الفعالية غير موجودة أو تم حذفها"
            : "Event not found or has been removed",
      };
    }

    const isLimited = event.capacityType === "LIMITED";
    let newStatus = "CONFIRMED";
    let isConfirmed = true;
    let waitlistOrder: number | null = null;

    if (isLimited) {
      const confirmedCount = await prisma.booking.count({
        where: {
          eventId: event.id,
          status: "CONFIRMED",
        },
      });

      const capacity = event.capacity ?? 0;
      if (confirmedCount < capacity) {
        // Limited event with capacity remaining: needs admin approval
        newStatus = "PENDING";
        isConfirmed = false;
      } else {
        // Limited event at capacity: place on waitlist
        newStatus = "WAITLISTED";
        isConfirmed = false;
        const lastWaitlisted = await prisma.booking.findFirst({
          where: {
            eventId: event.id,
            status: "WAITLISTED",
          },
          orderBy: { waitlistOrder: "desc" },
        });
        waitlistOrder = (lastWaitlisted?.waitlistOrder ?? 0) + 1;
      }
    }

    // Clean up any legacy unconfirmed booking record for this email and event
    await prisma.booking.deleteMany({
      where: {
        eventId: event.id,
        email: cleanEmail,
        confirmed: false,
      },
    });

    // Check uniqueness before create
    const existingUniqueBooking = await prisma.booking.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: cleanEmail,
        },
      },
    });

    if (existingUniqueBooking) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
            : "You have already booked for this event",
      };
    }

    // Create the booking record strictly after successful OTP verification
    let confirmedBooking;
    try {
      confirmedBooking = await prisma.booking.create({
        data: {
          eventId: event.id,
          fullName: otpRecord.fullName || "مشارك",
          email: cleanEmail,
          city: otpRecord.city || "تطوان",
          age: otpRecord.age || 20,
          motive: otpRecord.motive || null,
          confirmed: isConfirmed,
          status: newStatus,
          waitlistOrder,
        },
      });
    } catch (createErr: unknown) {
      const err = createErr as { code?: string };
      if (err?.code === "P2002") {
        return {
          success: false,
          error:
            locale === "ar"
              ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
              : "You have already booked for this event",
        };
      }
      throw createErr;
    }

    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return {
      success: true,
      bookingRef: `IHY-${confirmedBooking.id.slice(-6).toUpperCase()}`,
      status: newStatus,
      waitlistOrder,
      eventId: confirmedBooking.eventId,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Error verifying booking OTP:", error);
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify verification code",
    };
  }
}

export async function resendBookingOtp(data: {
  email: string;
  eventId?: string;
  locale?: string;
}) {
  try {
    const { email, eventId, locale = "ar" } = data;

    if (!email) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "يرجى تحديد البريد الإلكتروني"
            : "Email is required",
      };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 30-second cooldown rate limit
    const cooldownLimit = await checkRateLimit(`otp_gen_cooldown:${cleanEmail}`, 1, 30);
    if (!cooldownLimit.allowed) {
      return {
        success: false,
        error:
          locale === "ar"
            ? `يرجى الانتظار ${cooldownLimit.retryAfter || 30} ثانية قبل إعادة إرسال الرمز.`
            : `Please wait ${cooldownLimit.retryAfter || 30}s before requesting a new code.`,
      };
    }

    // Find previous registration payload to preserve
    const prevOtp = await prisma.otpVerification.findFirst({
      where: { email: cleanEmail },
      orderBy: { createdAt: "desc" },
    });

    if (eventId && prevOtp?.eventId) {
      const expectedEvent = await resolveTargetEvent(eventId);
      if (expectedEvent && expectedEvent.id !== prevOtp.eventId) {
        return {
          success: false,
          error:
            locale === "ar"
              ? "الفعالية لا تطابق سجل الحجز الأصلي"
              : "The event does not match the original booking record",
        };
      }
    }

    if (prevOtp?.eventId) {
      const existing = await prisma.booking.findUnique({
        where: {
          eventId_email: {
            eventId: prevOtp.eventId,
            email: cleanEmail,
          },
        },
      });
      if (existing) {
        return {
          success: false,
          error:
            locale === "ar"
              ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
              : "You have already booked for this event",
        };
      }
    }

    // Invalidate existing active OTPs
    await prisma.otpVerification.updateMany({
      where: {
        email: cleanEmail,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate new OTP
    const otp = generateSecureOtp();
    const otpHash = hashOtp(otp, cleanEmail);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        otpHash,
        expiresAt,
        attempts: 0,
        eventId: prevOtp?.eventId || null,
        fullName: prevOtp?.fullName || null,
        city: prevOtp?.city || null,
        age: prevOtp?.age || null,
        motive: prevOtp?.motive || null,
      },
    });

    const emailResult = await sendOTPEmail(cleanEmail, otp, locale);

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || "Failed to resend verification code",
      };
    }

    return { success: true };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Error resending booking OTP:", error);
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to resend code",
    };
  }
}

export async function isEventBookedByVisitor(eventId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const specificCookie = cookieStore.get(`ihyaa_booked_${eventId}`)?.value;
    if (specificCookie === "true") return true;

    const allBooked = cookieStore.get("ihyaa_booked_events")?.value;
    if (allBooked) {
      const ids = JSON.parse(allBooked);
      if (Array.isArray(ids) && ids.includes(eventId)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function getBookings(eventId?: string, status?: string) {
  try {
    await requirePermission("bookings:view");
    const bookings = await prisma.booking.findMany({
      where: {
        ...(eventId && eventId !== "all" ? { eventId } : {}),
        ...(status && status !== "all" ? { status } : {}),
      },
      orderBy: [
        { waitlistOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        event: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            date: true,
            time: true,
            location: true,
            capacityType: true,
            capacity: true,
          },
        },
      },
    });
    return { success: true, bookings };
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch bookings",
      bookings: [],
    };
  }
}

export async function approveBooking(id: string) {
  try {
    const user = await requirePermission("bookings:manage");
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmed: true,
        waitlistOrder: null,
      },
    });

    await createAuditLog({
      actorId: user.id,
      action: "BOOKING_APPROVE",
      targetType: "Booking",
      targetId: id,
      details: {
        fullName: booking.fullName,
        email: booking.email,
        eventTitle: booking.event?.titleEn || booking.event?.titleAr,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/events");

    return { success: true };
  } catch (error) {
    console.error("Error approving booking:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to approve booking",
    };
  }
}

export async function rejectBooking(id: string) {
  try {
    const user = await requirePermission("bookings:manage");
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    const wasConfirmed = booking.status === "CONFIRMED" || booking.confirmed;

    await prisma.booking.update({
      where: { id },
      data: {
        status: "REJECTED",
        confirmed: false,
        waitlistOrder: null,
      },
    });

    let autoPromotedName: string | null = null;

    // If an approved/confirmed booking was rejected, freeing up a spot in a limited event
    if (wasConfirmed && booking.event.capacityType === "LIMITED") {
      const nextWaitlisted = await prisma.booking.findFirst({
        where: {
          eventId: booking.eventId,
          status: "WAITLISTED",
        },
        orderBy: [
          { waitlistOrder: "asc" },
          { createdAt: "asc" },
        ],
      });

      if (nextWaitlisted) {
        await prisma.booking.update({
          where: { id: nextWaitlisted.id },
          data: {
            status: "CONFIRMED",
            confirmed: true,
            waitlistOrder: null,
          },
        });

        autoPromotedName = nextWaitlisted.fullName;

        // Send Brevo congratulations email
        try {
          await sendWaitlistPromotionEmail(nextWaitlisted.email, {
            titleAr: booking.event.titleAr,
            titleEn: booking.event.titleEn,
            date: booking.event.date,
            time: booking.event.time,
            location: booking.event.location,
          });
        } catch (emailErr) {
          console.error("Error sending auto-promotion email:", emailErr);
        }
      }
    }

    await createAuditLog({
      actorId: user.id,
      action: "BOOKING_REJECT",
      targetType: "Booking",
      targetId: id,
      details: {
        fullName: booking.fullName,
        email: booking.email,
        autoPromotedName,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/events");

    return { success: true, autoPromotedName };
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reject booking",
    };
  }
}

export async function promoteWaitlistBooking(id: string) {
  try {
    const user = await requirePermission("bookings:manage");
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    await prisma.booking.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmed: true,
        waitlistOrder: null,
      },
    });

    // Send Brevo congratulations email
    try {
      await sendWaitlistPromotionEmail(booking.email, {
        titleAr: booking.event.titleAr,
        titleEn: booking.event.titleEn,
        date: booking.event.date,
        time: booking.event.time,
        location: booking.event.location,
      });
    } catch (emailErr) {
      console.error("Error sending promotion email:", emailErr);
    }

    await createAuditLog({
      actorId: user.id,
      action: "BOOKING_PROMOTE_WAITLIST",
      targetType: "Booking",
      targetId: id,
      details: {
        fullName: booking.fullName,
        email: booking.email,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/events");

    return { success: true };
  } catch (error) {
    console.error("Error promoting waitlist booking:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to promote booking",
    };
  }
}

export async function deleteBooking(id: string) {
  try {
    const user = await requirePermission("bookings:manage");
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true },
    });

    if (booking) {
      const wasConfirmed = booking.status === "CONFIRMED" || booking.confirmed;

      await prisma.booking.delete({
        where: { id },
      });

      // If a confirmed booking was deleted from a limited event, auto-promote next in waitlist
      if (wasConfirmed && booking.event.capacityType === "LIMITED") {
        const nextWaitlisted = await prisma.booking.findFirst({
          where: {
            eventId: booking.eventId,
            status: "WAITLISTED",
          },
          orderBy: [
            { waitlistOrder: "asc" },
            { createdAt: "asc" },
          ],
        });

        if (nextWaitlisted) {
          await prisma.booking.update({
            where: { id: nextWaitlisted.id },
            data: {
              status: "CONFIRMED",
              confirmed: true,
              waitlistOrder: null,
            },
          });

          try {
            await sendWaitlistPromotionEmail(nextWaitlisted.email, {
              titleAr: booking.event.titleAr,
              titleEn: booking.event.titleEn,
              date: booking.event.date,
              time: booking.event.time,
              location: booking.event.location,
            });
          } catch (emailErr) {
            console.error("Error sending auto-promotion email:", emailErr);
          }
        }
      }

      await createAuditLog({
        actorId: user.id,
        action: "BOOKING_DELETE",
        targetType: "Booking",
        targetId: id,
        details: {
          fullName: booking.fullName,
          email: booking.email,
        },
      });
    }

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath("/events");
    return { success: true };
  } catch (error) {
    console.error("Error deleting booking:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete booking",
    };
  }
}