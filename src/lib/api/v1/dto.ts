import type { Role } from "@prisma/client";
import { resolveImageUrl } from "@/lib/content";
import { isEventEnded, isEventRegistrationOpen } from "@/lib/event-time";

export interface SelfUserDTO {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  city: string | null;
  age: number | null;
  image: string | null;
  coverImage: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  bio: string | null;
  studyLevel: string | null;
  institution: string | null;
  interests: string[];
  skills: string[];
  languages: string[];
  volunteerAreas: string[];
  theme: string | null;
  locale: string | null;
  reduceMotion: boolean;
  emailVerified: string | null;
  onboardingCompleted: boolean;
  mustChangePassword: boolean;
  hasPassword: boolean;
  friendRequestPolicy: "EVERYONE" | "NOBODY";
  showOnlineStatus: boolean;
  showFriendCount: boolean;
  friendCount: number;
  createdAt: string;
}

export interface ApiSessionDTO {
  id: string;
  deviceName: string | null;
  platform: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface EventDTO {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  date: string;
  time: string;
  location: string;
  posterUrl: string;
  posterWidth: number | null;
  posterHeight: number | null;
  isNew: boolean;
  bookingOpen: boolean;
  capacityType: string;
  capacity: number | null;
  confirmedCount: number;
  isFull: boolean;
  isEnded: boolean;
  isRegistrationOpen: boolean;
  userBookingStatus?: string | null;
}

export interface BookingDTO {
  id: string;
  bookingRef: string;
  eventId: string;
  status: string;
  confirmed: boolean;
  waitlistOrder: number | null;
  motive: string | null;
  createdAt: string;
  event: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    date: string;
    time: string;
    location: string;
    posterUrl: string | null;
    posterWidth: number | null;
    posterHeight: number | null;
    capacityType: string;
    isEnded: boolean;
  };
}

export function toApiSessionDTO(
  row: {
    id: string;
    deviceName: string | null;
    platform: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    lastUsedAt: Date;
    expiresAt: Date;
    createdAt: Date;
  },
  currentSessionId?: string | null,
): ApiSessionDTO {
  return {
    id: row.id,
    deviceName: row.deviceName,
    platform: row.platform,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    lastUsedAt: row.lastUsedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    isCurrent: Boolean(currentSessionId && row.id === currentSessionId),
  };
}

export function toEventDTO(
  ev: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
    date: Date;
    time: string;
    location: string;
    posterUrl: string;
    posterWidth: number | null;
    posterHeight: number | null;
    isNew: boolean;
    bookingOpen: boolean;
    capacityType: string;
    capacity: number | null;
    bookings?: Array<{ status: string; confirmed: boolean }>;
  },
  userBookingStatus?: string | null,
): EventDTO {
  const confirmedCount = (ev.bookings ?? []).filter(
    (b) => b.status === "CONFIRMED" || (b.confirmed && b.status !== "REJECTED"),
  ).length;
  const isLimited = ev.capacityType === "LIMITED";
  const isFull = isLimited && ev.capacity !== null && confirmedCount >= ev.capacity;
  const posterUrl = resolveImageUrl(ev.posterUrl) ?? ev.posterUrl;

  return {
    id: ev.id,
    slug: ev.slug,
    titleAr: ev.titleAr,
    titleEn: ev.titleEn,
    descriptionAr: ev.descriptionAr,
    descriptionEn: ev.descriptionEn,
    date: ev.date.toISOString(),
    time: ev.time,
    location: ev.location,
    posterUrl,
    posterWidth: ev.posterWidth,
    posterHeight: ev.posterHeight,
    isNew: ev.isNew,
    bookingOpen: ev.bookingOpen,
    capacityType: ev.capacityType,
    capacity: ev.capacity,
    confirmedCount,
    isFull,
    isEnded: isEventEnded(ev.date, ev.time),
    isRegistrationOpen: isEventRegistrationOpen(ev.date, ev.time, ev.bookingOpen),
    ...(userBookingStatus !== undefined ? { userBookingStatus } : {}),
  };
}

export function toBookingDTO(b: {
  id: string;
  eventId: string;
  status: string;
  confirmed: boolean;
  waitlistOrder: number | null;
  motive: string | null;
  createdAt: Date;
  event: {
    id: string;
    slug: string;
    titleAr: string;
    titleEn: string;
    date: Date;
    time: string;
    location: string;
    posterUrl: string | null;
    posterWidth: number | null;
    posterHeight: number | null;
    capacityType: string;
  };
}): BookingDTO {
  return {
    id: b.id,
    bookingRef: `IHY-${b.id.slice(-6).toUpperCase()}`,
    eventId: b.eventId,
    status: b.status,
    confirmed: b.confirmed,
    waitlistOrder: b.waitlistOrder,
    motive: b.motive,
    createdAt: b.createdAt.toISOString(),
    event: {
      id: b.event.id,
      slug: b.event.slug,
      titleAr: b.event.titleAr,
      titleEn: b.event.titleEn,
      date: b.event.date.toISOString().split("T")[0],
      time: b.event.time,
      location: b.event.location,
      posterUrl: resolveImageUrl(b.event.posterUrl),
      posterWidth: b.event.posterWidth,
      posterHeight: b.event.posterHeight,
      capacityType: b.event.capacityType,
      isEnded: isEventEnded(b.event.date, b.event.time),
    },
  };
}
