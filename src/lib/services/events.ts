import { logActivity } from "@/lib/audit";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { resolveImageUrl } from "@/lib/content";
import { isEventEnded } from "@/lib/event-time";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isSafePublicImageUrl } from "@/lib/upload-security";
import { toEventDTO } from "@/lib/api/v1/dto";

export interface EventsActor {
  id: string;
  role: string;
}

function slugifyTitle(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "event"
  );
}

async function generateUniqueEventSlug(baseInput: string, excludeId?: string) {
  const base = slugifyTitle(baseInput);
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${counter++}`;
  }
}

export async function fetchAdminEventsForActor(actor: EventsActor | null) {
  if (!actor?.id) {
    throw new UnauthorizedError();
  }
  if (!can(actor.role, "events:update") && !can(actor.role, "bookings:view")) {
    throw new ForbiddenError("events:update");
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

export async function listPublicEventsForViewer(params?: {
  viewerUserId?: string | null;
  skip?: number;
  take?: number;
}) {
  const take = params?.take ? Math.min(50, Math.max(1, params.take)) : 20;
  const skip = params?.skip ? Math.max(0, params.skip) : 0;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      orderBy: { date: "asc" },
      skip,
      take,
      include: {
        bookings: {
          select: {
            userId: true,
            status: true,
            confirmed: true,
          },
        },
      },
    }),
    prisma.event.count(),
  ]);

  const items = events.map((ev) => {
    const userBooking = params?.viewerUserId
      ? ev.bookings.find((b) => b.userId === params.viewerUserId)
      : undefined;
    return toEventDTO(ev, params?.viewerUserId ? (userBooking?.status ?? null) : undefined);
  });

  return { events: items, total };
}

export async function getEventByIdOrSlugForViewer(
  idOrSlug: string,
  viewerUserId?: string | null,
) {
  const clean = idOrSlug.trim();
  if (!clean) return null;

  const event = await prisma.event.findFirst({
    where: {
      OR: [{ id: clean }, { slug: clean }],
    },
    include: {
      bookings: {
        select: {
          userId: true,
          status: true,
          confirmed: true,
        },
      },
    },
  });

  if (!event) return null;

  const userBooking = viewerUserId
    ? event.bookings.find((b) => b.userId === viewerUserId)
    : undefined;

  return toEventDTO(event, viewerUserId ? (userBooking?.status ?? null) : undefined);
}

export async function createEventForActor(
  actor: EventsActor | null,
  input: {
    titleAr: string;
    titleEn: string;
    descriptionAr?: string;
    descriptionEn?: string;
    date: string | Date;
    time?: string;
    location: string;
    posterUrl?: string | null;
    isNew?: boolean;
    bookingOpen?: boolean;
    capacityType?: string;
    capacity?: number | null;
    slug?: string;
  },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "events:create")) throw new ForbiddenError();

  const titleAr = input.titleAr.trim();
  const titleEn = input.titleEn.trim();
  const location = input.location.trim();
  const time = input.time?.trim() || "18:00";
  const parsedDate = input.date instanceof Date ? input.date : new Date(input.date);

  if (!titleAr || !titleEn || !location || Number.isNaN(parsedDate.getTime())) {
    return {
      success: false as const,
      status: 400,
      error: "Event Title (Ar & En), valid Date, and Location are required.",
    };
  }

  const capacityType =
    input.capacityType?.trim().toUpperCase() === "LIMITED" ? "LIMITED" : "OPEN";
  let capacity: number | null = null;
  if (capacityType === "LIMITED") {
    if (!input.capacity || !Number.isInteger(input.capacity) || input.capacity <= 0) {
      return {
        success: false as const,
        status: 400,
        error: "Capacity must be greater than 0 for limited events.",
      };
    }
    capacity = input.capacity;
  }

  const posterUrl = input.posterUrl?.trim() || "/images/gathering.jpg";
  if (posterUrl !== "/images/gathering.jpg" && !isSafePublicImageUrl(posterUrl)) {
    return { success: false as const, status: 400, error: "Invalid poster URL." };
  }

  const slug = await generateUniqueEventSlug(input.slug?.trim() || titleEn || titleAr);

  const event = await prisma.event.create({
    data: {
      slug,
      titleAr,
      titleEn,
      descriptionAr: input.descriptionAr?.trim() || "",
      descriptionEn: input.descriptionEn?.trim() || "",
      date: parsedDate,
      time,
      location,
      posterUrl,
      posterWidth: null,
      posterHeight: null,
      isNew: Boolean(input.isNew),
      bookingOpen: input.bookingOpen ?? true,
      capacityType,
      capacity,
    },
  });

  await logActivity({
    actorId: actor.id,
    action: "event.create",
    targetType: "event",
    targetId: event.id,
    details: { titleAr: event.titleAr, titleEn: event.titleEn },
  });

  return { success: true as const, event };
}

export async function updateEventForActor(
  actor: EventsActor | null,
  id: string,
  input: {
    titleAr?: string;
    titleEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    date?: string | Date;
    time?: string;
    location?: string;
    posterUrl?: string | null;
    isNew?: boolean;
    bookingOpen?: boolean;
    capacityType?: string;
    capacity?: number | null;
  },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "events:update")) throw new ForbiddenError();

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return { success: false as const, status: 404, error: "Event not found" };
  }

  const nextCapacityType =
    input.capacityType !== undefined
      ? input.capacityType.trim().toUpperCase() === "LIMITED"
        ? "LIMITED"
        : "OPEN"
      : existing.capacityType;

  let nextCapacity = input.capacity !== undefined ? input.capacity : existing.capacity;
  if (nextCapacityType === "OPEN") {
    nextCapacity = null;
  } else if (!nextCapacity || !Number.isInteger(nextCapacity) || nextCapacity <= 0) {
    return {
      success: false as const,
      status: 400,
      error: "Capacity must be greater than 0 for limited events.",
    };
  }

  let nextPosterUrl = existing.posterUrl;
  let resetDimensions = false;
  if (input.posterUrl !== undefined && input.posterUrl !== null) {
    const cleanPoster = input.posterUrl.trim();
    if (!isSafePublicImageUrl(cleanPoster)) {
      return { success: false as const, status: 400, error: "Invalid poster URL." };
    }
    if (cleanPoster !== existing.posterUrl) {
      nextPosterUrl = cleanPoster;
      resetDimensions = true;
    }
  }

  let nextDate = existing.date;
  if (input.date !== undefined) {
    const parsed = input.date instanceof Date ? input.date : new Date(input.date);
    if (Number.isNaN(parsed.getTime())) {
      return { success: false as const, status: 400, error: "Invalid event date." };
    }
    nextDate = parsed;
  }

  const slug =
    existing.slug ||
    (await generateUniqueEventSlug(
      input.titleEn?.trim() || input.titleAr?.trim() || existing.titleEn || existing.titleAr,
      id,
    ));

  const event = await prisma.event.update({
    where: { id },
    data: {
      slug,
      titleAr: input.titleAr !== undefined ? input.titleAr.trim() : existing.titleAr,
      titleEn: input.titleEn !== undefined ? input.titleEn.trim() : existing.titleEn,
      descriptionAr:
        input.descriptionAr !== undefined
          ? input.descriptionAr.trim()
          : existing.descriptionAr,
      descriptionEn:
        input.descriptionEn !== undefined
          ? input.descriptionEn.trim()
          : existing.descriptionEn,
      date: nextDate,
      time: input.time !== undefined ? input.time.trim() : existing.time,
      location: input.location !== undefined ? input.location.trim() : existing.location,
      isNew: input.isNew !== undefined ? input.isNew : existing.isNew,
      bookingOpen:
        input.bookingOpen !== undefined ? input.bookingOpen : existing.bookingOpen,
      capacityType: nextCapacityType,
      capacity: nextCapacity,
      posterUrl: nextPosterUrl,
      ...(resetDimensions ? { posterWidth: null, posterHeight: null } : {}),
    },
  });

  await logActivity({
    actorId: actor.id,
    action: "event.update",
    targetType: "event",
    targetId: event.id,
    details: { titleAr: event.titleAr, titleEn: event.titleEn },
  });

  if (resetDimensions && existing.posterUrl && existing.posterUrl !== nextPosterUrl) {
    deleteImageFromCloudinary(existing.posterUrl).catch(() => {});
  }

  return { success: true as const, event };
}

export async function deleteEventForActor(
  actor: EventsActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "events:delete")) throw new ForbiddenError();

  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true, posterUrl: true },
  });
  if (!existing) {
    return { success: false as const, status: 404, error: "Event not found" };
  }

  if (existing.posterUrl) {
    await deleteImageFromCloudinary(existing.posterUrl).catch(() => {});
  }

  await prisma.event.delete({ where: { id } });

  await logActivity({
    actorId: actor.id,
    action: "event.delete",
    targetType: "event",
    targetId: id,
  });

  return { success: true as const };
}
