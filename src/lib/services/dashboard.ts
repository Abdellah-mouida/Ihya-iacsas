import { prisma } from "@/lib/prisma";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";

export interface DashboardActor {
  id: string;
  role?: string | null;
}

export async function fetchDashboardStatsForActor(actor: DashboardActor | null | undefined) {
  if (!actor?.id) {
    throw new UnauthorizedError();
  }
  if (!can(actor.role, "bookings:view")) {
    throw new ForbiddenError();
  }

  const [
    carouselCount,
    activeCarouselCount,
    galleryCount,
    totalEventsCount,
    upcomingEventsCount,
    totalBookingsCount,
    contactMessagesCount,
    recentBookings,
  ] = await Promise.all([
    prisma.carouselPost.count().catch(() => 0),
    prisma.carouselPost.count({ where: { active: true } }).catch(() => 0),
    prisma.galleryPhoto.count().catch(() => 0),
    prisma.event.count().catch(() => 0),
    prisma.event.count({ where: { bookingOpen: true } }).catch(() => 0),
    prisma.booking.count().catch(() => 0),
    prisma.contactMessage.count().catch(() => 0),
    prisma.booking
      .findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          email: true,
          city: true,
          createdAt: true,
          event: {
            select: {
              titleAr: true,
              titleEn: true,
            },
          },
        },
      })
      .catch(() => []),
  ]);

  return {
    stats: {
      carouselCount,
      activeCarouselCount,
      galleryCount,
      totalEventsCount,
      upcomingEventsCount,
      totalBookingsCount,
      contactMessagesCount,
    },
    recentBookings,
  };
}
