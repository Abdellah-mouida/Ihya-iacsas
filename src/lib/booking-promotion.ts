import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";
import { sendWaitlistPromotionEmail } from "@/lib/email";
import { notify } from "@/lib/notifications";

export type BookingPromotionRecord = {
  id: string;
  eventId: string;
  userId?: string | null;
  email: string;
  fullName: string;
  event: {
    slug: string;
    titleAr: string;
    titleEn: string;
    date: Date;
    time: string;
    location: string;
    capacityType?: string;
    capacity?: number | null;
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

export async function deliverBookingPromotionEffects(
  booking: BookingPromotionRecord,
  actor: PromotionActor,
  sourceAction: string,
  dependencies: PromotionDependencies = {},
) {
  if (booking.userId) {
    const isDirectApproval = sourceAction === "BOOKING_APPROVE";
    await notify(
      booking.userId,
      isDirectApproval ? "BOOKING_APPROVED" : "BOOKING_WAITLIST_PROMOTED",
      {
        params: {
          eventTitleAr: booking.event.titleAr,
          eventTitleEn: booking.event.titleEn,
        },
        data: {
          bookingId: booking.id,
          eventId: booking.eventId,
          slug: booking.event.slug,
        },
        dedupeKey: `booking:${booking.id}:${isDirectApproval ? "approved" : "promoted"}`,
      },
    );
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
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email transport failed";
    console.error(`[booking:${booking.id}] Approval email failed:`, message);
    await logActivity({
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
    return false;
  }
}

/** Claim the next waitlisted booking within an existing locked event transaction. */
export async function promoteNextWaitlistedInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
) {
  const event = await tx.event.findUnique({
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
      capacity: true,
    },
  });
  if (!event || event.capacityType !== "LIMITED") return null;

  const confirmedCount = await tx.booking.count({
    where: { eventId, status: "CONFIRMED" },
  });
  if (confirmedCount >= (event.capacity ?? 0)) return null;

  const nextWaitlisted = await tx.booking.findFirst({
    where: { eventId, status: "WAITLISTED", confirmed: false },
    orderBy: [{ waitlistOrder: "asc" }, { createdAt: "asc" }],
    include: { user: { select: { locale: true } } },
  });
  if (!nextWaitlisted) return null;

  const claimed = await tx.booking.updateMany({
    where: { id: nextWaitlisted.id, status: "WAITLISTED", confirmed: false },
    data: { status: "CONFIRMED", confirmed: true, waitlistOrder: null },
  });
  if (claimed.count !== 1) return null;

  return { ...nextWaitlisted, event } satisfies BookingPromotionRecord;
}

/** Claim one waiting-to-confirmed transition, then send the shared promotion email. */
export async function confirmBookingAndNotify(
  booking: BookingPromotionRecord,
  actor: PromotionActor,
  sourceAction: string,
  dependencies: PromotionDependencies = {},
) {
  const txResult = await prisma.$transaction(
    async (tx) => {
      // Lock the event row to serialize concurrent capacity & waitlist claims
      await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${booking.eventId} FOR UPDATE`;

      const eventRow = await tx.event.findUnique({
        where: { id: booking.eventId },
        select: { capacityType: true, capacity: true },
      });

      if (eventRow?.capacityType === "LIMITED") {
        const confirmedCount = await tx.booking.count({
          where: { eventId: booking.eventId, status: "CONFIRMED" },
        });
        if (confirmedCount >= (eventRow.capacity ?? 0)) {
          return { changed: false, capacityFull: true } as const;
        }
      }

      const transition = await tx.booking.updateMany({
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

      return { changed: transition.count === 1, capacityFull: false } as const;
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  if (!txResult.changed) {
    return {
      changed: false,
      emailSent: false,
      capacityFull: txResult.capacityFull,
    };
  }

  const emailSent = await deliverBookingPromotionEffects(
    booking,
    actor,
    sourceAction,
    dependencies,
  );
  return { changed: true, emailSent, capacityFull: false };
}

export async function promoteNextWaitlistedBooking(
  eventId: string,
  actor: PromotionActor,
  sourceAction: string,
  dependencies: PromotionDependencies = {},
) {
  const promoted = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      return promoteNextWaitlistedInTx(tx, eventId);
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  if (!promoted) return { changed: false, emailSent: false };

  const emailSent = await deliverBookingPromotionEffects(
    promoted,
    actor,
    sourceAction,
    dependencies,
  );

  await logActivity({
    actorId: actor.id,
    actorName: actor.name,
    actorEmail: actor.email,
    action: "BOOKING_PROMOTE_WAITLIST",
    targetType: "Booking",
    targetId: promoted.id,
    targetName: promoted.fullName,
    targetEmail: promoted.email,
    details: {
      sourceAction,
      approvalEmailSent: emailSent,
    },
  });

  return { changed: true, emailSent };
}
