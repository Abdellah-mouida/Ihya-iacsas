import type { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import {
  confirmBookingAndNotify,
  deliverBookingPromotionEffects,
  promoteNextWaitlistedInTx,
} from "@/lib/booking-promotion";
import { isEventEnded } from "@/lib/event-time";
import { notify } from "@/lib/notifications";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export interface BookingsActor {
  id: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

export async function resolveTargetEvent(eventId?: string) {
  if (eventId) {
    const trimmed = eventId.trim();
    return prisma.event.findFirst({
      where: {
        OR: [{ slug: trimmed }, { id: trimmed }],
      },
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
      notFound: true,
      error:
        locale === "ar"
          ? "الفعالية المطلوبة غير موجودة"
          : "The requested event was not found",
    };
  }

  if (!event.bookingOpen || isEventEnded(event.date, event.time)) {
    return {
      success: false as const,
      closed: true,
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
  const txOutcome = await prisma.$transaction(
    async (tx) => {
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
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

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
      ended: true,
      error: isAr
        ? "لا يمكن إلغاء الحجز لفعالية قد انتهت"
        : "Cannot cancel booking for an event that has already ended",
    };
  }

  const txResult = await prisma.$transaction(
    async (tx) => {
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
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

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

export async function getBookingByIdForActor(
  actor: BookingsActor | null,
  bookingId: string,
) {
  if (!actor?.id) throw new UnauthorizedError();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { event: true },
  });

  if (!booking) return null;

  const isOwner =
    booking.userId === actor.id ||
    (actor.email && booking.email.toLowerCase() === actor.email.toLowerCase());

  if (!isOwner && !can(actor.role, "bookings:view")) {
    throw new ForbiddenError();
  }

  return booking;
}

export async function listAdminBookingsForActor(
  actor: BookingsActor | null,
  filters?: { eventId?: string; status?: string; skip?: number; take?: number },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "bookings:view")) throw new ForbiddenError();

  const where: Prisma.BookingWhereInput = {};
  if (filters?.eventId) {
    where.eventId = filters.eventId;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const take = filters?.take ? Math.min(100, Math.max(1, filters.take)) : undefined;
  const skip = filters?.skip ? Math.max(0, filters.skip) : undefined;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { event: true },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total };
}

export async function approveBookingForActor(
  actor: BookingsActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "bookings:manage")) throw new ForbiddenError();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: true, user: { select: { locale: true } } },
  });

  if (!booking) {
    return { success: false as const, status: 404, error: "Booking not found" };
  }

  if (booking.status === "CONFIRMED" || booking.confirmed) {
    return { success: true as const, alreadyApproved: true };
  }

  const promotion = await confirmBookingAndNotify(
    booking,
    { id: actor.id, name: actor.name, email: actor.email },
    "BOOKING_APPROVE",
  );

  if (!promotion.changed) {
    if (promotion.capacityFull) {
      return { success: false as const, status: 409, error: "Event capacity is full" };
    }
    const latest = await prisma.booking.findUnique({
      where: { id },
      select: { status: true },
    });
    if (latest?.status === "CONFIRMED") {
      return { success: true as const, alreadyApproved: true };
    }
    return {
      success: false as const,
      status: 409,
      error: "Booking status changed before approval",
    };
  }

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "BOOKING_APPROVE",
    targetType: "Booking",
    targetId: id,
    targetName: booking.fullName,
    targetEmail: booking.email,
    details: {
      fullName: booking.fullName,
      email: booking.email,
      approvalEmailSent: promotion.emailSent,
    },
  });

  return {
    success: true as const,
    eventId: booking.eventId,
    approvalEmailSent: promotion.emailSent,
  };
}

export async function rejectBookingForActor(
  actor: BookingsActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "bookings:manage")) throw new ForbiddenError();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: true, user: { select: { locale: true } } },
  });

  if (!booking) {
    return { success: false as const, status: 404, error: "Booking not found" };
  }

  if (booking.status === "REJECTED") {
    return { success: true as const, alreadyRejected: true, autoPromotedName: null };
  }

  const txResult = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${booking.eventId} FOR UPDATE`;

      const current = await tx.booking.findUnique({
        where: { id },
        select: { status: true, confirmed: true },
      });
      if (!current || current.status === "REJECTED") {
        return { changed: false as const, promoted: null };
      }

      const wasConfirmed = current.status === "CONFIRMED" || current.confirmed;
      const updated = await tx.booking.updateMany({
        where: { id, status: { not: "REJECTED" } },
        data: { status: "REJECTED", confirmed: false, waitlistOrder: null },
      });
      if (updated.count !== 1) {
        return { changed: false as const, promoted: null };
      }

      const promoted = wasConfirmed
        ? await promoteNextWaitlistedInTx(tx, booking.eventId)
        : null;

      return { changed: true as const, promoted };
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  if (!txResult.changed) {
    return { success: true as const, alreadyRejected: true, autoPromotedName: null };
  }

  if (booking.userId) {
    await notify(booking.userId, "BOOKING_REJECTED", {
      params: {
        eventTitleAr: booking.event.titleAr,
        eventTitleEn: booking.event.titleEn,
      },
      data: {
        bookingId: booking.id,
        eventId: booking.eventId,
        slug: booking.event.slug,
      },
      dedupeKey: `booking:${booking.id}:rejected`,
    });
  }

  let autoPromotedName: string | null = null;
  if (txResult.promoted) {
    autoPromotedName = txResult.promoted.fullName;
    await deliverBookingPromotionEffects(
      txResult.promoted,
      { id: actor.id, name: actor.name, email: actor.email },
      "BOOKING_AUTO_PROMOTE_AFTER_REJECT",
    );
  }

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "BOOKING_REJECT",
    targetType: "Booking",
    targetId: id,
    targetName: booking.fullName,
    targetEmail: booking.email,
    details: {
      fullName: booking.fullName,
      email: booking.email,
      autoPromotedName,
    },
  });

  return { success: true as const, eventId: booking.eventId, autoPromotedName };
}

export async function promoteWaitlistBookingForActor(
  actor: BookingsActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "bookings:manage")) throw new ForbiddenError();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: true, user: { select: { locale: true } } },
  });

  if (!booking) {
    return { success: false as const, status: 404, error: "Booking not found" };
  }

  if (booking.status === "CONFIRMED" || booking.confirmed) {
    return { success: true as const, alreadyApproved: true };
  }
  if (booking.status !== "WAITLISTED") {
    return {
      success: false as const,
      status: 400,
      error: "Only waitlisted bookings can be promoted",
    };
  }

  const promotion = await confirmBookingAndNotify(
    booking,
    { id: actor.id, name: actor.name, email: actor.email },
    "BOOKING_PROMOTE_WAITLIST",
  );
  if (!promotion.changed) {
    if (promotion.capacityFull) {
      return { success: false as const, status: 409, error: "Event capacity is full" };
    }
    const latest = await prisma.booking.findUnique({
      where: { id },
      select: { status: true },
    });
    if (latest?.status === "CONFIRMED") {
      return { success: true as const, alreadyApproved: true };
    }
    return {
      success: false as const,
      status: 409,
      error: "Booking status changed before promotion",
    };
  }

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "BOOKING_PROMOTE_WAITLIST",
    targetType: "Booking",
    targetId: id,
    targetName: booking.fullName,
    targetEmail: booking.email,
    details: {
      fullName: booking.fullName,
      email: booking.email,
      approvalEmailSent: promotion.emailSent,
    },
  });

  return {
    success: true as const,
    eventId: booking.eventId,
    approvalEmailSent: promotion.emailSent,
  };
}

export async function deleteBookingForActor(
  actor: BookingsActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "bookings:manage")) throw new ForbiddenError();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { event: true, user: { select: { locale: true } } },
  });

  if (!booking) {
    return { success: false as const, status: 404, error: "Booking not found" };
  }

  const txResult = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${booking.eventId} FOR UPDATE`;
      const current = await tx.booking.findUnique({
        where: { id },
        select: { id: true, status: true, confirmed: true },
      });
      if (!current) return { deleted: false as const, promoted: null };

      const wasConfirmed = current.status === "CONFIRMED" || current.confirmed;
      const deleted = await tx.booking.deleteMany({ where: { id } });
      if (deleted.count !== 1) return { deleted: false as const, promoted: null };

      const promoted = wasConfirmed
        ? await promoteNextWaitlistedInTx(tx, booking.eventId)
        : null;
      return { deleted: true as const, promoted };
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  if (txResult.promoted) {
    await deliverBookingPromotionEffects(
      txResult.promoted,
      { id: actor.id, name: actor.name, email: actor.email },
      "BOOKING_AUTO_PROMOTE_AFTER_DELETE",
    );
  }

  if (txResult.deleted) {
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "BOOKING_DELETE",
      targetType: "Booking",
      targetId: id,
      targetName: booking.fullName,
      targetEmail: booking.email,
      details: {
        fullName: booking.fullName,
        email: booking.email,
      },
    });
  }

  return { success: true as const };
}
