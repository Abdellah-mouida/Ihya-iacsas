"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { safeRevalidatePath } from "@/lib/cache";
import { isEventEnded } from "@/lib/event-time";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";
import { confirmBookingAndNotify } from "@/lib/booking-promotion";
import { notify } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

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
            userId: user.id,
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

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      action: "BOOKING_CREATED",
      targetType: "Booking",
      targetId: booking.id,
      targetName: booking.fullName,
      targetEmail: booking.email,
      details: {
        eventId: event.id,
        eventTitle: event.titleEn || event.titleAr,
        status: newStatus,
        waitlistOrder,
      },
    });

    safeRevalidatePath("/events");
    safeRevalidatePath("/book");
    safeRevalidatePath("/profile");
    safeRevalidatePath("/settings");
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
      error: "Failed to create booking",
    };
  }
}

export async function isEventBookedByVisitor(eventId: string): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user?.id || !eventId) return false;
    const event = await resolveTargetEvent(eventId);
    if (!event) return false;
    return Boolean(await prisma.booking.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
      select: { id: true },
    }));
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
      include: { event: true, user: { select: { locale: true } } },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status === "CONFIRMED" || booking.confirmed) {
      return { success: true, alreadyApproved: true };
    }
    if (booking.status !== "PENDING" && booking.status !== "WAITLISTED") {
      return { success: false, error: "Only pending or waitlisted bookings can be approved" };
    }

    const approval = await confirmBookingAndNotify(booking, user, "BOOKING_APPROVE");
    if (!approval.changed) {
      const latest = await prisma.booking.findUnique({ where: { id }, select: { status: true } });
      if (latest?.status === "CONFIRMED") return { success: true, alreadyApproved: true };
      return { success: false, error: "Booking status changed before approval" };
    }

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
      action: "BOOKING_APPROVE",
      targetType: "Booking",
      targetId: id,
      targetName: booking.fullName,
      targetEmail: booking.email,
      details: {
        fullName: booking.fullName,
        email: booking.email,
        eventTitle: booking.event?.titleEn || booking.event?.titleAr,
        approvalEmailSent: approval.emailSent,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/events");

    return { success: true, approvalEmailSent: approval.emailSent };
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
      include: { event: true, user: { select: { locale: true } } },
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
        include: { user: { select: { locale: true } } },
      });

      if (nextWaitlisted) {
        const promotion = await confirmBookingAndNotify(
          { ...nextWaitlisted, event: booking.event },
          user,
          "BOOKING_AUTO_PROMOTE_AFTER_REJECT",
        );
        if (promotion.changed) autoPromotedName = nextWaitlisted.fullName;
      }
    }

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
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
      include: { event: true, user: { select: { locale: true } } },
    });

    if (!booking) {
      return { success: false, error: "Booking not found" };
    }

    if (booking.status === "CONFIRMED" || booking.confirmed) {
      return { success: true, alreadyApproved: true };
    }
    if (booking.status !== "WAITLISTED") {
      return { success: false, error: "Only waitlisted bookings can be promoted" };
    }
    const promotion = await confirmBookingAndNotify(booking, user, "BOOKING_PROMOTE_WAITLIST");
    if (!promotion.changed) {
      const latest = await prisma.booking.findUnique({ where: { id }, select: { status: true } });
      if (latest?.status === "CONFIRMED") return { success: true, alreadyApproved: true };
      return { success: false, error: "Booking status changed before promotion" };
    }

    await logActivity({
      actorId: user.id,
      actorName: user.name,
      actorEmail: user.email,
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

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath(`/events/${booking.eventId}`);
    revalidatePath("/events");

    return { success: true, approvalEmailSent: promotion.emailSent };
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
      include: { event: true, user: { select: { locale: true } } },
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
          include: { user: { select: { locale: true } } },
        });

        if (nextWaitlisted) {
          await confirmBookingAndNotify(
            { ...nextWaitlisted, event: booking.event },
            user,
            "BOOKING_AUTO_PROMOTE_AFTER_DELETE",
          );
        }
      }

      await logActivity({
        actorId: user.id,
        actorName: user.name,
        actorEmail: user.email,
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
