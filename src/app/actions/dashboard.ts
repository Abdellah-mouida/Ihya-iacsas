"use server";

import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  try {
    const [carouselCount, activeCarouselCount, galleryCount, totalEventsCount, upcomingEventsCount, totalBookingsCount, recentBookings] =
      await Promise.all([
        prisma.carouselPost.count(),
        prisma.carouselPost.count({ where: { active: true } }),
        prisma.galleryPhoto.count(),
        prisma.event.count(),
        prisma.event.count({ where: { bookingOpen: true } }),
        prisma.booking.count(),
        prisma.booking.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            event: {
              select: {
                titleAr: true,
                titleEn: true,
              },
            },
          },
        }),
      ]);

    return {
      success: true,
      stats: {
        carouselCount,
        activeCarouselCount,
        galleryCount,
        totalEventsCount,
        upcomingEventsCount,
        totalBookingsCount,
      },
      recentBookings,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return {
      success: false,
      error: "Failed to load dashboard statistics",
    };
  }
}
