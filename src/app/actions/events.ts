"use server";

import { revalidatePath } from "next/cache";

import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function getEvents() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });
    return { success: true, events };
  } catch (error) {
    console.error("Error fetching events:", error);
    return { success: false, error: "Failed to fetch events", events: [] };
  }
}

export async function getPublicEvents() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
    });

    const openEvents = events.filter((e) => e.bookingOpen);
    const pastEvents = events.filter((e) => !e.bookingOpen);
    const hasNew = openEvents.some((e) => e.isNew);

    return { success: true, events, openEvents, pastEvents, hasNew };
  } catch (error) {
    console.error("Error fetching public events:", error);
    return {
      success: false,
      error: "Failed to fetch events",
      events: [],
      openEvents: [],
      pastEvents: [],
      hasNew: false,
    };
  }
}

export async function createEvent(formData: FormData) {
  try {
    const titleAr = formData.get("titleAr") as string;
    const titleEn = formData.get("titleEn") as string;
    const descriptionAr = formData.get("descriptionAr") as string;
    const descriptionEn = formData.get("descriptionEn") as string;
    const dateStr = formData.get("date") as string;
    const time = formData.get("time") as string;
    const location = formData.get("location") as string;
    const isNew = formData.get("isNew") === "true" || formData.get("isNew") === "on";
    const bookingOpen = formData.get("bookingOpen") === "true" || formData.get("bookingOpen") === "on";

    const file = formData.get("image") as File | null;
    let posterUrl = formData.get("posterUrl") as string | null;

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      posterUrl = await uploadImageToCloudinary(buffer, "ihyaa-events");
    }

    if (!titleAr || !titleEn || !dateStr || !location) {
      return { success: false, error: "Title, Date, and Location are required" };
    }

    if (!posterUrl) {
      posterUrl = "/images/event-poster.jpg"; // Default fallback
    }

    const event = await prisma.event.create({
      data: {
        titleAr,
        titleEn,
        descriptionAr: descriptionAr || "",
        descriptionEn: descriptionEn || "",
        date: new Date(dateStr),
        time: time || "18:00",
        location,
        posterUrl,
        isNew,
        bookingOpen,
      },
    });

    revalidatePath("/");
    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/admin/events");

    return { success: true, event };
  } catch (error) {
    console.error("Error creating event:", error);
    return { success: false, error: "Failed to create event" };
  }
}

export async function updateEvent(id: string, formData: FormData) {
  try {
    const titleAr = formData.get("titleAr") as string;
    const titleEn = formData.get("titleEn") as string;
    const descriptionAr = formData.get("descriptionAr") as string;
    const descriptionEn = formData.get("descriptionEn") as string;
    const dateStr = formData.get("date") as string;
    const time = formData.get("time") as string;
    const location = formData.get("location") as string;
    const isNew = formData.get("isNew") === "true" || formData.get("isNew") === "on";
    const bookingOpen = formData.get("bookingOpen") === "true" || formData.get("bookingOpen") === "on";

    const file = formData.get("image") as File | null;

    const dataToUpdate: Record<string, unknown> = {
      titleAr,
      titleEn,
      descriptionAr,
      descriptionEn,
      date: new Date(dateStr),
      time,
      location,
      isNew,
      bookingOpen,
    };

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      dataToUpdate.posterUrl = await uploadImageToCloudinary(buffer, "ihyaa-events");
    }

    const event = await prisma.event.update({
      where: { id },
      data: dataToUpdate,
    });

    revalidatePath("/");
    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/admin/events");

    return { success: true, event };
  } catch (error) {
    console.error("Error updating event:", error);
    return { success: false, error: "Failed to update event" };
  }
}

export async function toggleEventStatus(id: string, field: "isNew" | "bookingOpen", value: boolean) {
  try {
    const event = await prisma.event.update({
      where: { id },
      data: { [field]: value },
    });

    revalidatePath("/");
    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/admin/events");

    return { success: true, event };
  } catch (error) {
    console.error("Error toggling event status:", error);
    return { success: false, error: "Failed to toggle event status" };
  }
}

export async function deleteEvent(id: string) {
  try {
    await prisma.event.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/events");
    revalidatePath("/admin");
    revalidatePath("/admin/events");

    return { success: true };
  } catch (error) {
    console.error("Error deleting event:", error);
    return { success: false, error: "Failed to delete event" };
  }
}
