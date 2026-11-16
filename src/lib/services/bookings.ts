import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { isEventEnded } from "@/lib/event-time";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deliverBookingPromotionEffects,
  promoteNextWaitlistedInTx,
} from "@/lib/booking-promotion";

export async function resolveTargetEvent(eventId?: string) {
  if (eventId) {
    const trimmed = eventId.trim();
    const exact = await prisma.event.findFirst({
      where: {
        OR: [{ slug: trimmed }, { id: trimmed }],
      },
    });
    if (exact) return exact;

    return prisma.event.findFirst({
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
  }

  return prisma.event.findFirst({
    where: { bookingOpen: true },
    orderBy: { date: "asc" },
  });
}

export async function createBookingForUser(params: {
  userId: string;
  eventId?: string;
  motive?: string;
  locale?: string;
}) {
  const { userId, eventId, motive, locale = "ar" } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      success: false as const,
      needsOnboarding: true,
      error:
        locale === "ar"
          ? "يرجى إكمال بياناتك الشخصية أولاً"
          : "Please complete your profile first",
    };
  }

  const event = await resolveTargetEvent(eventId);
  if (!event) {
    return {
      success: false as const,
      error:
        locale === "ar"
          ? "الفعالية المطلوبة غير موجودة"
          : "The requested event was not found",
    };
  }

  if (!event.bookingOpen || isEventEnded(event.date, event.time)) {
    return {
      success: false as const,
      error:
        locale === "ar"
          ? "انتهت هذه الفعالية أو أُغلق التسجيل فيها"
          : "This event has ended or registration is closed",
    };
  }

  const rateLimit = await checkRateLimit(`auth_book:${user.id}`, 5, 3600);
  if (!rateLimit.allowed) {
    return {
      success: false as const,
      rateLimited: true,
      error:
        locale === "ar"
          ? "طلبات حجز كثيرة جداً. يرجى المحاولة لاحقاً."
          : "Too many booking requests. Please try again later.",
    };
  }

  const userEmail = user.email;
  const txOutcome = await prisma.$transaction(async (tx) => {
    // Serialize capacity and waitlist order assignment per event
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${event.id} FOR UPDATE`;

    const existingBooking = await tx.booking.findFirst({
      where: {
        eventId: event.id,
        OR: [{ userId: user.id }, { email: userEmail }],
      },
      select: { id: true },
    });

    if (existingBooking) {
      return { alreadyBooked: true as const };
    }

    const isLimited = event.capacityType === "LIMITED";
    let newStatus = "CONFIRMED";
    let isConfirmed = true;
    let waitlistOrder: number | null = null;

    if (isLimited) {
      const confirmedCount = await tx.booking.count({
        where: { eventId: event.id, status: "CONFIRMED" },
      });
      const capacity = event.capacity ?? 0;
      if (confirmedCount < capacity) {
        newStatus = "PENDING";
        isConfirmed = false;
      } else {
        newStatus = "WAITLISTED";
        isConfirmed = false;
        const lastWaitlisted = await tx.booking.findFirst({
          where: { eventId: event.id, status: "WAITLISTED" },
          orderBy: { waitlistOrder: "desc" },
          select: { waitlistOrder: true },
        });
        waitlistOrder = (lastWaitlisted?.waitlistOrder ?? 0) + 1;
      }
    }

    const booking = await tx.booking.create({
      data: {
        eventId: event.id,
        userId: user.id,
        fullName: user.name || "مشارك",
        email: userEmail,
        city: user.city!,
        age: user.age!,
        motive: motive?.trim() || null,
        confirmed: isConfirmed,
        status: newStatus,
        waitlistOrder,
      },
    });

    return {
      alreadyBooked: false as const,
      booking,
      newStatus,
      waitlistOrder,
    };
  });

  if (txOutcome.alreadyBooked) {
    return {
      success: false as const,
      alreadyBooked: true,
      error:
        locale === "ar"
          ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
          : "You have already booked for this event",
    };
  }

  await logActivity({
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    action: "BOOKING_CREATED",
    targetType: "Booking",
    targetId: txOutcome.booking.id,
    targetName: txOutcome.booking.fullName,
    targetEmail: txOutcome.booking.email,
    details: {
      eventId: event.id,
      eventTitle: event.titleEn || event.titleAr,
      status: txOutcome.newStatus,
      waitlistOrder: txOutcome.waitlistOrder,
    },
  });

  return {
    success: true as const,
    bookingId: txOutcome.booking.id,
    bookingRef: `IHY-${txOutcome.booking.id.slice(-6).toUpperCase()}`,
    status: txOutcome.newStatus,
    waitlistOrder: txOutcome.waitlistOrder,
    eventId: event.id,
  };
}

export async function cancelBookingForUser(params: {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  bookingId: string;
  locale?: string;
}) {
  const { userId, userEmail, userName, bookingId, locale = "ar" } = params;
  const isAr = locale === "ar";

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true },
  });

  if (!booking) {
    return {
      success: false as const,
      notFound: true,
      error: isAr ? "الحجز غير موجود" : "Booking not found",
    };
  }

  const isOwner =
    booking.userId === userId ||
    (userEmail && booking.email.toLowerCase() === userEmail.toLowerCase());

  if (!isOwner) {
    return {
      success: false as const,
      forbidden: true,
      error: isAr
        ? "غير مصرح لك بإلغاء هذا الحجز"
        : "You are not authorized to cancel this booking",
    };
  }

  if (isEventEnded(booking.event.date, booking.event.time)) {
    return {
      success: false as const,
      error: isAr
        ? "لا يمكن إلغاء الحجز لفعالية قد انتهت"
        : "Cannot cancel booking for an event that has already ended",
    };
  }

  const txResult = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${booking.eventId} FOR UPDATE`;

    const existing = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, confirmed: true },
    });
    if (!existing) {
      return { deleted: false as const, promoted: null };
    }

    const wasConfirmed = existing.status === "CONFIRMED" || existing.confirmed;
    const deleted = await tx.booking.deleteMany({
      where: { id: bookingId },
    });
    if (deleted.count !== 1) {
      return { deleted: false as const, promoted: null };
    }

    const promoted = wasConfirmed
      ? await promoteNextWaitlistedInTx(tx, booking.eventId)
      : null;

    return { deleted: true as const, promoted };
  });

  if (!txResult.deleted) {
    return {
      success: false as const,
      notFound: true,
      error: isAr ? "الحجز غير موجود" : "Booking not found",
    };
  }

  await logActivity({
    actorId: userId,
    actorName: userName,
    actorEmail: userEmail,
    action: "BOOKING_CANCELLED",
    targetType: "Booking",
    targetId: booking.id,
    targetName: booking.fullName,
    targetEmail: booking.email,
    details: {
      eventId: booking.eventId,
      eventTitle: booking.event.titleEn || booking.event.titleAr,
      previousStatus: booking.status,
    },
  });

  if (txResult.promoted) {
    await deliverBookingPromotionEffects(
      txResult.promoted,
      { id: userId, name: userName, email: userEmail },
      "BOOKING_AUTO_PROMOTE_AFTER_CANCEL",
    );

    await logActivity({
      actorId: userId,
      actorName: userName,
      actorEmail: userEmail,
      action: "BOOKING_PROMOTE_WAITLIST",
      targetType: "Booking",
      targetId: txResult.promoted.id,
      targetName: txResult.promoted.fullName,
      targetEmail: txResult.promoted.email,
      details: {
        sourceAction: "BOOKING_AUTO_PROMOTE_AFTER_CANCEL",
        eventId: booking.eventId,
        eventTitle: booking.event.titleEn || booking.event.titleAr,
      },
    });
  }

  return { success: true as const };
}
