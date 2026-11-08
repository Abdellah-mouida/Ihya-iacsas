import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { sendWaitlistPromotionEmail } from "@/lib/email";

export type BookingPromotionRecord = {
  id: string;
  eventId: string;
  email: string;
  fullName: string;
  event: {
    slug: string;
    titleAr: string;
    titleEn: string;
    date: Date;
    time: string;
    location: string;
  };
  user: { locale: string | null } | null;
};

export type PromotionActor = {
  id: string | null;
  name?: string | null;
  email?: string | null;
};

type PromotionEmailSender = typeof sendWaitlistPromotionEmail;

export type PromotionDependencies = {
  sendEmail?: PromotionEmailSender;
};

/** Claim one waiting-to-confirmed transition, then send the shared promotion email. */
export async function confirmBookingAndNotify(
  booking: BookingPromotionRecord,
  actor: PromotionActor,
  sourceAction: string,
  dependencies: PromotionDependencies = {},
) {
  const transition = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: { in: ["PENDING", "WAITLISTED"] },
      confirmed: false,
    },
    data: {
      status: "CONFIRMED",
      confirmed: true,
      waitlistOrder: null,
    },
  });

  if (transition.count !== 1) {
    return { changed: false, emailSent: false };
  }

  try {
    const sendEmail = dependencies.sendEmail ?? sendWaitlistPromotionEmail;
    const result = await sendEmail(
      booking.email,
      {
        titleAr: booking.event.titleAr,
        titleEn: booking.event.titleEn,
        date: booking.event.date,
        time: booking.event.time,
        location: booking.event.location,
        url: `/events/${booking.event.slug}/book`,
      },
      booking.user?.locale || "ar",
      { sendOnce: true },
    );
    if (!result.success) throw new Error(result.error || "Email transport failed");
    return { changed: true, emailSent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email transport failed";
    console.error(`[booking:${booking.id}] Approval email failed:`, message);
    await createAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "BOOKING_APPROVAL_EMAIL_FAILED",
      targetType: "Booking",
      targetId: booking.id,
      targetName: booking.fullName,
      targetEmail: booking.email,
      details: { sourceAction, email: booking.email, error: message },
    });
    return { changed: true, emailSent: false };
  }
}

export async function promoteNextWaitlistedBooking(
  eventId: string,
  actor: PromotionActor,
  sourceAction: string,
  dependencies: PromotionDependencies = {},
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      titleAr: true,
      titleEn: true,
      date: true,
      time: true,
      location: true,
      capacityType: true,
    },
  });

  if (!event || event.capacityType !== "LIMITED") {
    return { changed: false, emailSent: false };
  }

  const nextWaitlisted = await prisma.booking.findFirst({
    where: { eventId, status: "WAITLISTED" },
    orderBy: [{ waitlistOrder: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { locale: true } } },
  });

  if (!nextWaitlisted) return { changed: false, emailSent: false };

  const promotion = await confirmBookingAndNotify(
    { ...nextWaitlisted, event },
    actor,
    sourceAction,
    dependencies,
  );

  if (promotion.changed) {
    await createAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
      action: "BOOKING_PROMOTE_WAITLIST",
      targetType: "Booking",
      targetId: nextWaitlisted.id,
      targetName: nextWaitlisted.fullName,
      targetEmail: nextWaitlisted.email,
      details: {
        sourceAction,
        approvalEmailSent: promotion.emailSent,
      },
    });
  }

  return promotion;
}
