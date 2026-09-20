"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ALLOWED_EMAIL_DOMAINS } from "@/lib/constants";
import { sendOTPEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

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

    // Find target event (either specified ID or the latest open event)
    let event = await prisma.event.findFirst({
      where: eventId ? { id: eventId } : { bookingOpen: true },
      orderBy: { date: "asc" },
    });

    if (!event) {
      event = await prisma.event.findFirst({
        orderBy: { date: "desc" },
      });
    }

    if (!event) {
      event = await prisma.event.create({
        data: {
          titleAr: "مجلس إحياء الشبابي",
          titleEn: "Ihyaa Youth Gathering",
          descriptionAr: "لقاء إيماني شبابي لتزكية النفوس ومدارسة العلم",
          descriptionEn: "A youth gathering for spiritual growth and study",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          time: "20:30",
          location: "المقر الرئيسي — تطوان",
          posterUrl:
            "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/event_poster.jpg",
          bookingOpen: true,
        },
      });
    }

    if (!event.bookingOpen) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "الحجز لهذه الفعالية مغلق حالياً"
            : "Booking for this event is currently closed",
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

    // Create new secure OTP verification record
    await prisma.otpVerification.create({
      data: {
        email: cleanEmail,
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    // Check if there's an existing unconfirmed booking attempt or create one
    let booking = await prisma.booking.findFirst({
      where: {
        eventId: event.id,
        email: cleanEmail,
        confirmed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (booking) {
      booking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          fullName: fullName.trim(),
          city: city.trim(),
          age,
          motive: motive?.trim() || null,
        },
      });
    } else {
      booking = await prisma.booking.create({
        data: {
          eventId: event.id,
          fullName: fullName.trim(),
          email: cleanEmail,
          city: city.trim(),
          age,
          motive: motive?.trim() || null,
          confirmed: false,
        },
      });
    }

    // Send the verification code via MailerSend
    const emailResult = await sendOTPEmail(cleanEmail, otp, locale);

    if (!emailResult.success) {
      return {
        success: false,
        error: emailResult.error || "Failed to send verification code email",
      };
    }

    return {
      success: true,
      bookingId: booking.id,
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
  locale?: string;
}) {
  try {
    const { bookingId, email, otp, locale = "ar" } = data;

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

    // Find the latest active OTP record for this email
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        email: cleanEmail,
        usedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

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

    // Single-use: mark OTP as used immediately
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { usedAt: now },
    });

    // Find and confirm booking
    let booking = bookingId
      ? await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { event: true },
        })
      : null;

    if (!booking) {
      booking = await prisma.booking.findFirst({
        where: {
          email: cleanEmail,
          confirmed: false,
        },
        orderBy: { createdAt: "desc" },
        include: { event: true },
      });
    }

    if (!booking) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "طلب الحجز غير موجود"
            : "Booking attempt not found",
      };
    }

    const confirmedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmed: true },
    });

    // Set signed/recognizing cookies
    const cookieStore = await cookies();
    cookieStore.set(`ihyaa_booked_${booking.eventId}`, "true", {
      maxAge: 60 * 60 * 24 * 60, // 60 days
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    const existingBookedCookie = cookieStore.get("ihyaa_booked_events")?.value;
    let bookedEvents: string[] = [];
    if (existingBookedCookie) {
      try {
        bookedEvents = JSON.parse(existingBookedCookie);
      } catch {
        bookedEvents = [];
      }
    }
    if (!bookedEvents.includes(booking.eventId)) {
      bookedEvents.push(booking.eventId);
    }
    cookieStore.set("ihyaa_booked_events", JSON.stringify(bookedEvents), {
      maxAge: 60 * 60 * 24 * 60,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return {
      success: true,
      bookingRef: `IHY-${confirmedBooking.id.slice(-6).toUpperCase()}`,
      eventId: booking.eventId,
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
  locale?: string;
}) {
  try {
    const { email, locale = "ar" } = data;

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

export async function getBookings(eventId?: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        ...(eventId && eventId !== "all" ? { eventId } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            date: true,
            location: true,
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

export async function deleteBooking(id: string) {
  try {
    await prisma.booking.delete({
      where: { id },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
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