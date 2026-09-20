"use server";

import { prisma } from "@/lib/prisma";

export async function getDashboardStats(locale = "ar") {
  try {
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
          include: {
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
      success: true,
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
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch dashboard stats:", error);
    }
    return {
      success: false,
      error:
        locale === "ar"
          ? "فشل في تحميل إحصائيات لوحة التحكم"
          : "Failed to load dashboard statistics",
    };
  }
}
