"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

export async function getBookings(eventId?: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: eventId && eventId !== "all" ? { eventId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: {
            id: true,
            titleAr: true,
            titleEn: true,
            date: true,
            location: true,
          },
        },
      },
    });
    return { success: true, bookings };
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch bookings",
      bookings: [],
    };
  }
}

export async function createBooking(data: {
  eventId?: string;
  fullName: string;
  email: string;
  phone: string;
}) {
  try {
    const { eventId, fullName, email, phone } = data;

    if (!fullName || !email || !phone) {
      return { success: false, error: "Please fill in all required fields (Name, Email, Phone)" };
    }

    // Find target event (either specified ID or the latest open event)
    const event = await prisma.event.findFirst({
      where: eventId ? { id: eventId } : { bookingOpen: true },
      orderBy: { date: "asc" },
    });

    if (!event) {
      return { success: false, error: "No active event found for booking" };
    }

    if (!event.bookingOpen) {
      return { success: false, error: "Booking for this event is currently closed" };
    }

    const booking = await prisma.booking.create({
      data: {
        eventId: event.id,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      },
      include: {
        event: true,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return {
      success: true,
      booking,
      bookingRef: `IHY-${booking.id.slice(-6).toUpperCase()}`,
    };
  } catch (error) {
    console.error("Error creating booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process booking submission",
    };
  }
}

export async function deleteBooking(id: string) {
  try {
    await prisma.booking.delete({
      where: { id },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/bookings");

    return { success: true };
  } catch (error) {
    console.error("Error deleting booking:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete booking record",
    };
  }
}
