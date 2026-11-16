import { resolveImageUrl } from "@/lib/content";
import { isEventEnded } from "@/lib/event-time";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export interface EventsActor {
  id: string;
  role: string;
}

export async function fetchAdminEventsForActor(actor: EventsActor | null) {
  if (!actor?.id) {
    throw new UnauthorizedError();
  }
  if (!can(actor.role, "events:update") && !can(actor.role, "bookings:view")) {
    throw new ForbiddenError();
  }

  const events = await prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      bookings: {
        select: {
          status: true,
          confirmed: true,
        },
      },
    },
  });

  return events.map((ev) => {
    const confirmedCount = ev.bookings.filter(
      (b) => b.status === "CONFIRMED" || (b.confirmed && b.status !== "REJECTED"),
    ).length;
    const pendingCount = ev.bookings.filter((b) => b.status === "PENDING").length;
    const waitlistCount = ev.bookings.filter((b) => b.status === "WAITLISTED").length;
    const rejectedCount = ev.bookings.filter((b) => b.status === "REJECTED").length;

    const { bookings: eventBookings, ...eventRest } = ev;

    return {
      ...eventRest,
      posterUrl: resolveImageUrl(ev.posterUrl) ?? ev.posterUrl,
      posterWidth: ev.posterWidth,
      posterHeight: ev.posterHeight,
      isEnded: isEventEnded(ev.date, ev.time),
      _count: {
        bookings: eventBookings.length,
      },
      counts: {
        total: eventBookings.length,
        confirmed: confirmedCount,
        pending: pendingCount,
        waitlisted: waitlistCount,
        rejected: rejectedCount,
      },
    };
  });
}
