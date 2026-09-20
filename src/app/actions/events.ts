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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch events",
      events: [],
    };
  }
}

export async function getPublicEvents() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
    });

    const now = new Date();
    // An event is open/active if its date has not passed and booking is open
    const openEvents = events.filter(
      (e) => new Date(e.date) >= now && e.bookingOpen,
    );
    const pastEvents = events.filter(
      (e) => new Date(e.date) < now || !e.bookingOpen,
    );
    const hasNew = openEvents.length > 0;

    return { success: true, events, openEvents, pastEvents, hasNew };
  } catch (error) {
    console.error("Error fetching public events:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch events",
      events: [],
      openEvents: [],
      pastEvents: [],
      hasNew: false,
    };
  }
}

export async function createEvent(formData: FormData) {
  try {
    const titleAr = (formData.get("titleAr") as string)?.trim();
    const titleEn = (formData.get("titleEn") as string)?.trim();
    const descriptionAr = (formData.get("descriptionAr") as string)?.trim() || "";
    const descriptionEn = (formData.get("descriptionEn") as string)?.trim() || "";
    const dateStr = (formData.get("date") as string)?.trim();
    const time = (formData.get("time") as string)?.trim() || "18:00";
    const location = (formData.get("location") as string)?.trim();
    const isNew = formData.get("isNew") === "true" || formData.get("isNew") === "on";
    const bookingOpen = formData.get("bookingOpen") === "true" || formData.get("bookingOpen") === "on";

    const file = formData.get("image") as File | null;
    let posterUrl = (formData.get("posterUrl") as string | null)?.trim() || null;

    if (file && file.size > 0) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        posterUrl = await uploadImageToCloudinary(buffer, "ihyaa-events");
      } catch (uploadErr) {
        if (!posterUrl) {
          const errMsg =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Event poster upload failed";
          return { success: false, error: errMsg };
        }
      }
    }

    if (!titleAr || !titleEn || !dateStr || !location) {
      return { success: false, error: "Event Title (Ar & En), Date, and Location are required." };
    }

    if (!posterUrl) {
      posterUrl = "/images/event-poster.jpg"; // Default fallback poster
    }

    const event = await prisma.event.create({
      data: {
        titleAr,
        titleEn,
        descriptionAr,
        descriptionEn,
        date: new Date(dateStr),
        time,
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save event to database",
    };
  }
}

export async function updateEvent(id: string, formData: FormData) {
  try {
    const titleAr = (formData.get("titleAr") as string)?.trim();
    const titleEn = (formData.get("titleEn") as string)?.trim();
    const descriptionAr = (formData.get("descriptionAr") as string)?.trim() || "";
    const descriptionEn = (formData.get("descriptionEn") as string)?.trim() || "";
    const dateStr = (formData.get("date") as string)?.trim();
    const time = (formData.get("time") as string)?.trim();
    const location = (formData.get("location") as string)?.trim();
    const isNew = formData.get("isNew") === "true" || formData.get("isNew") === "on";
    const bookingOpen = formData.get("bookingOpen") === "true" || formData.get("bookingOpen") === "on";

    const file = formData.get("image") as File | null;
    const posterUrl = (formData.get("posterUrl") as string | null)?.trim() || null;

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
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        dataToUpdate.posterUrl = await uploadImageToCloudinary(buffer, "ihyaa-events");
      } catch (uploadErr) {
        if (posterUrl) {
          dataToUpdate.posterUrl = posterUrl;
        } else {
          return {
            success: false,
            error: uploadErr instanceof Error ? uploadErr.message : "Upload failed",
          };
        }
      }
    } else if (posterUrl) {
      dataToUpdate.posterUrl = posterUrl;
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update event",
    };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to toggle event status",
    };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete event",
    };
  }
}
