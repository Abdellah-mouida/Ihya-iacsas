"use server";

import { requirePermission } from "@/lib/permissions";
import { fetchDashboardStatsForActor } from "@/lib/services/dashboard";

export async function getDashboardStats(locale = "ar") {
  try {
    const actor = await requirePermission("bookings:view");
    const data = await fetchDashboardStatsForActor({
      id: actor.id,
      role: actor.role,
    });

    return {
      success: true as const,
      ...data,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch dashboard stats:", error);
    }
    return {
      success: false as const,
      error:
        locale === "ar"
          ? "فشل في تحميل إحصائيات لوحة التحكم"
          : "Failed to load dashboard statistics",
    };
  }
}
