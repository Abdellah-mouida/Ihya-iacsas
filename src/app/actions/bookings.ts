"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { safeRevalidatePath } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";
import {
  confirmBookingAndNotify,
  deliverBookingPromotionEffects,
  promoteNextWaitlistedInTx,
} from "@/lib/booking-promotion";
import {
  createBookingForUser,
  resolveTargetEvent,
} from "@/lib/services/bookings";
import { notify } from "@/lib/notifications";
import { safeActionError } from "@/lib/safe-error";

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

    const result = await createBookingForUser({
      userId: session.user.id,
      eventId,
      motive,
      locale,
    });

    if (!result.success) {
      return result;
    }

    safeRevalidatePath("/events");
    safeRevalidatePath("/book");
    safeRevalidatePath("/profile");
    safeRevalidatePath("/settings");
    safeRevalidatePath("/admin");
    safeRevalidatePath("/admin/bookings");

    return {
      success: true,
      bookingRef: result.bookingRef,
      status: result.status,
      waitlistOrder: result.waitlistOrder,
      eventId: result.eventId,
    };
  } catch (error) {
    const err = error as { code?: string };
    if (err?.code === "P2002") {
      const locale = data.locale || "ar";
      return {
        success: false,
        alreadyBooked: true,
        error:
          locale === "ar"
            ? "لقد قمت بالحجز في هذه الفعالية مسبقاً"
            : "You have already booked for this event",
      };
    }
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
      error: safeActionError(error, "Failed to fetch bookings"),
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
      if (approval.capacityFull) {
        return { success: false, error: "Event capacity is full" };
      }
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
      error: safeActionError(error, "Failed to approve booking"),
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

    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${booking.eventId} FOR UPDATE`;
      const current = await tx.booking.findUnique({
        where: { id },
        select: { id: true, status: true, confirmed: true },
      });
      if (!current) return { changed: false as const, promoted: null };

      const wasConfirmed = current.status === "CONFIRMED" || current.confirmed;
      const updated = await tx.booking.updateMany({
        where: { id, status: { not: "REJECTED" } },
        data: { status: "REJECTED", confirmed: false, waitlistOrder: null },
      });
      if (updated.count !== 1) return { changed: false as const, promoted: null };

      const promoted = wasConfirmed
        ? await promoteNextWaitlistedInTx(tx, booking.eventId)
        : null;
      return { changed: true as const, promoted };
    });

    if (txResult.changed && booking.userId) {
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
        user,
        "BOOKING_AUTO_PROMOTE_AFTER_REJECT",
      );
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
      error: safeActionError(error, "Failed to reject booking"),
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
      if (promotion.capacityFull) {
        return { success: false, error: "Event capacity is full" };
      }
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
      error: safeActionError(error, "Failed to promote booking"),
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
      const txResult = await prisma.$transaction(async (tx) => {
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
      });

      if (txResult.promoted) {
        await deliverBookingPromotionEffects(
          txResult.promoted,
          user,
          "BOOKING_AUTO_PROMOTE_AFTER_DELETE",
        );
      }

      if (txResult.deleted) {
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
    }

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");
    revalidatePath("/events");
    return { success: true };
  } catch (error) {
    console.error("Error deleting booking:", error);
    return {
      success: false,
      error: safeActionError(error, "Failed to delete booking"),
    };
  }
}
