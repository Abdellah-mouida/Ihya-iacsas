"use server";

import { revalidatePath } from "next/cache";

import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { isEventEnded, isEventRegistrationOpen } from "@/lib/event-time";
import { prisma } from "@/lib/prisma";
import { generateUniqueEventSlug } from "@/lib/slug";

export async function getEvents() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            confirmed: true,
          },
        },
      },
    });

    const enrichedEvents = events.map((ev) => {
      const confirmedCount = ev.bookings.filter(
        (b) => b.status === "CONFIRMED" || (b.confirmed && b.status !== "REJECTED"),
      ).length;
      const pendingCount = ev.bookings.filter((b) => b.status === "PENDING").length;
      const waitlistCount = ev.bookings.filter((b) => b.status === "WAITLISTED").length;
      const rejectedCount = ev.bookings.filter((b) => b.status === "REJECTED").length;

      return {
        ...ev,
        isEnded: isEventEnded(ev.date, ev.time),
        _count: {
          bookings: ev.bookings.length,
        },
        counts: {
          total: ev.bookings.length,
          confirmed: confirmedCount,
          pending: pendingCount,
          waitlisted: waitlistCount,
          rejected: rejectedCount,
        },
      };
    });

    return { success: true, events: enrichedEvents };
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
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            confirmed: true,
          },
        },
      },
    });

    const enriched = events.map((ev) => {
      const confirmedCount = ev.bookings.filter(
        (b) => b.status === "CONFIRMED" || (b.confirmed && b.status !== "REJECTED"),
      ).length;
      const isLimited = ev.capacityType === "LIMITED";
      const isFull = isLimited && ev.capacity !== null && confirmedCount >= ev.capacity;

      return {
        id: ev.id,
        slug: ev.slug,
        titleAr: ev.titleAr,
        titleEn: ev.titleEn,
        descriptionAr: ev.descriptionAr,
        descriptionEn: ev.descriptionEn,
        date: ev.date,
        time: ev.time,
        location: ev.location,
        posterUrl: ev.posterUrl,
        isNew: ev.isNew,
        bookingOpen: ev.bookingOpen,
        capacityType: ev.capacityType,
        capacity: ev.capacity,
        confirmedCount,
        isFull,
      };
    });

    // An event is open/active if its date/time has not ended and booking is open
    const openEvents = enriched.filter(
      (e) => !isEventEnded(e.date, e.time) && e.bookingOpen,
    );
    const pastEvents = enriched.filter(
      (e) => isEventEnded(e.date, e.time) || !e.bookingOpen,
    );
    const hasNew = openEvents.length > 0;

    return { success: true, events: enriched, openEvents, pastEvents, hasNew };
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

export async function getEventById(id: string) {
  try {
    let event = await prisma.event.findFirst({
      where: {
        OR: [
          { slug: id },
          { id },
        ],
      },
      include: {
        bookings: {
          select: {
            id: true,
            status: true,
            confirmed: true,
          },
        },
      },
    });

    if (!event) {
      event = await prisma.event.findFirst({
        where: {
          OR: [
            { slug: { startsWith: id } },
            { slug: { contains: id } },
            { id: { startsWith: id } },
            { id: { contains: id } },
          ],
        },
        orderBy: { date: "asc" },
        include: {
          bookings: {
            select: {
              id: true,
              status: true,
              confirmed: true,
            },
          },
        },
      });
    }

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    const confirmedCount = event.bookings.filter(
      (b) => b.status === "CONFIRMED" || (b.confirmed && b.status !== "REJECTED"),
    ).length;
    const isLimited = event.capacityType === "LIMITED";
    const isFull =
      isLimited && event.capacity !== null && confirmedCount >= event.capacity;

    return {
      success: true,
      event: {
        id: event.id,
        slug: event.slug,
        titleAr: event.titleAr,
        titleEn: event.titleEn,
        descriptionAr: event.descriptionAr,
        descriptionEn: event.descriptionEn,
        date: event.date,
        time: event.time,
        location: event.location,
        posterUrl: event.posterUrl,
        bookingOpen: event.bookingOpen,
        capacityType: event.capacityType,
        capacity: event.capacity,
        confirmedCount,
        isFull,
        isEnded: isEventEnded(event.date, event.time),
        isRegistrationOpen: isEventRegistrationOpen(
          event.date,
          event.time,
          event.bookingOpen,
        ),
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch event",
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

    const capacityTypeRaw = (formData.get("capacityType") as string)?.trim()?.toUpperCase();
    const capacityType = capacityTypeRaw === "LIMITED" ? "LIMITED" : "OPEN";
    let capacity: number | null = null;
    if (capacityType === "LIMITED") {
      const capParsed = parseInt((formData.get("capacity") as string) || "0", 10);
      if (isNaN(capParsed) || capParsed <= 0) {
        return { success: false, error: "Capacity must be greater than 0 for limited events." };
      }
      capacity = capParsed;
    }

    const file = formData.get("image") as File | null;
    let posterUrl = (formData.get("posterUrl") as string | null)?.trim() || null;

    if (file && file.size > 8 * 1024 * 1024) {
      return { success: false, error: "Image file size exceeds the 8MB limit." };
    }

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

    const slugRaw = (formData.get("slug") as string)?.trim() || titleEn || titleAr;
    const slug = await generateUniqueEventSlug(slugRaw);

    const event = await prisma.event.create({
      data: {
        slug,
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
        capacityType,
        capacity,
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

    const capacityTypeRaw = (formData.get("capacityType") as string)?.trim()?.toUpperCase();
    const capacityType = capacityTypeRaw === "LIMITED" ? "LIMITED" : "OPEN";
    let capacity: number | null = null;
    if (capacityType === "LIMITED") {
      const capParsed = parseInt((formData.get("capacity") as string) || "0", 10);
      if (isNaN(capParsed) || capParsed <= 0) {
        return { success: false, error: "Capacity must be greater than 0 for limited events." };
      }
      capacity = capParsed;
    }

    const file = formData.get("image") as File | null;
    const posterUrl = (formData.get("posterUrl") as string | null)?.trim() || null;

    if (file && file.size > 8 * 1024 * 1024) {
      return { success: false, error: "Image file size exceeds the 8MB limit." };
    }

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
      capacityType,
      capacity,
    };

    // Preserve immutable slug on title or details edit.
    // If the event already has a slug, it remains strictly immutable.
    // Only generate a slug if a legacy record has no slug.
    const existing = await prisma.event.findUnique({
      where: { id },
      select: { slug: true },
    });
    if (!existing) {
      return { success: false, error: "Event not found" };
    }
    if (!existing.slug) {
      dataToUpdate.slug = await generateUniqueEventSlug(titleEn || titleAr, id);
    }

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
