"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { sendOtpEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { ALLOWED_EMAIL_DOMAINS } from "@/lib/constants";

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
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
        error: locale === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill in all required fields",
      };
    }

    if (age < 5 || age > 120) {
      return {
        success: false,
        error: locale === "ar" ? "يرجى إدخال عمر صحيح" : "Please enter a valid age",
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailParts = cleanEmail.split("@");
    if (emailParts.length !== 2) {
      return {
        success: false,
        error: locale === "ar" ? "صيغة البريد الإلكتروني غير صحيحة" : "Invalid email format",
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
          posterUrl: "https://res.cloudinary.com/dp5cuxwyi/image/upload/v1747800000/ihyaa/event_poster.jpg",
          bookingOpen: true,
        },
      });
    }

    if (!event.bookingOpen) {
      return {
        success: false,
        error: locale === "ar" ? "الحجز لهذه الفعالية مغلق حالياً" : "Booking for this event is currently closed",
      };
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
          otpHash,
          otpExpiry,
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
          otpHash,
          otpExpiry,
          confirmed: false,
        },
      });
    }

    // Send the verification code via transactional email
    const emailResult = await sendOtpEmail({
      email: cleanEmail,
      otp,
      locale,
    });

    if (!emailResult.success) {
      return {
        success: false,
        error:
          locale === "ar"
            ? `فشل إرسال رمز التحقق: ${emailResult.error}`
            : `Failed to send verification code: ${emailResult.error}`,
      };
    }

    return {
      success: true,
      bookingId: booking.id,
      email: cleanEmail,
      eventId: event.id,
    };
  } catch (error) {
    console.error("Error requesting booking OTP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to initiate booking verification",
    };
  }
}

export async function verifyBookingOtp(data: {
  bookingId: string;
  otp: string;
  locale?: string;
}) {
  try {
    const { bookingId, otp, locale = "ar" } = data;

    if (!bookingId || !otp) {
      return {
        success: false,
        error: locale === "ar" ? "يرجى إدخال رمز التحقق" : "Please enter the verification code",
      };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { event: true },
    });

    if (!booking) {
      return {
        success: false,
        error: locale === "ar" ? "طلب الحجز غير موجود" : "Booking attempt not found",
      };
    }

    if (booking.confirmed) {
      return {
        success: true,
        bookingRef: `IHY-${booking.id.slice(-6).toUpperCase()}`,
        eventId: booking.eventId,
      };
    }

    if (!booking.otpExpiry || new Date() > booking.otpExpiry) {
      return {
        success: false,
        expired: true,
        error:
          locale === "ar"
            ? "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد."
            : "Verification code has expired. Please request a new code.",
      };
    }

    const submittedHash = hashOtp(otp);
    if (submittedHash !== booking.otpHash) {
      return {
        success: false,
        error:
          locale === "ar"
            ? "رمز التحقق غير صحيح. يرجى التأكد والمحاولة مرة أخرى."
            : "Invalid verification code. Please check and try again.",
      };
    }

    // Mark booking as confirmed
    const confirmedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        confirmed: true,
        otpHash: null,
        otpExpiry: null,
      },
    });

    // Set signed/recognizing cookie for this event
    const cookieStore = await cookies();
    cookieStore.set(`ihyaa_booked_${booking.eventId}`, "true", {
      maxAge: 60 * 60 * 24 * 60, // 60 days
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });

    // Also update JSON array of booked event IDs
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
    console.error("Error verifying booking OTP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to verify code",
    };
  }
}

export async function resendBookingOtp(data: {
  bookingId: string;
  locale?: string;
}) {
  try {
    const { bookingId, locale = "ar" } = data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return {
        success: false,
        error: locale === "ar" ? "طلب الحجز غير موجود" : "Booking attempt not found",
      };
    }

    if (booking.confirmed) {
      return {
        success: false,
        error: locale === "ar" ? "هذا الحجز مؤكد بالفعل" : "This booking is already confirmed",
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        otpHash,
        otpExpiry,
      },
    });

    const emailResult = await sendOtpEmail({
      email: booking.email,
      otp,
      locale,
    });

    if (!emailResult.success) {
      return {
        success: false,
        error:
          locale === "ar"
            ? `فشل إعادة إرسال الرمز: ${emailResult.error}`
            : `Failed to resend code: ${emailResult.error}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error resending booking OTP:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resend code",
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
        confirmed: true,
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
      error: error instanceof Error ? error.message : "Failed to fetch bookings",
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
      error: error instanceof Error ? error.message : "Failed to delete booking",
    };
  }
}