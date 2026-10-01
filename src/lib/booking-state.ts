import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribeBookingState(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notifyBookingChange() {
  listeners.forEach((listener) => listener());
}

export function isEventBooked(eventId: string): boolean {
  if (typeof window === "undefined" || !eventId) return false;

  try {
    if (localStorage.getItem(`ihyaa_booked_${eventId}`) === "true") {
      return true;
    }
  } catch {}

  try {
    if (document.cookie.includes(`ihyaa_booked_${eventId}=true`)) {
      return true;
    }

    const match = document.cookie.match(/(?:^|;\s*)ihyaa_booked_events=([^;]+)/);
    if (match) {
      const bookedList = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(bookedList) && bookedList.includes(eventId)) {
        return true;
      }
    }
  } catch {}

  return false;
}

export function markEventBooked(eventId: string, bookingRef?: string): void {
  if (typeof window === "undefined" || !eventId) return;

  try {
    localStorage.setItem(`ihyaa_booked_${eventId}`, "true");
    if (bookingRef) {
      localStorage.setItem(`ihyaa_booking_ref_${eventId}`, bookingRef);
      localStorage.setItem("ihyaa_booked_ref", bookingRef);
    }
  } catch {}

  try {
    const maxAge = 60 * 60 * 24 * 60;
    document.cookie = `ihyaa_booked_${eventId}=true; path=/; max-age=${maxAge}; SameSite=Lax`;

    let bookedList: string[] = [];
    const match = document.cookie.match(/(?:^|;\s*)ihyaa_booked_events=([^;]+)/);
    if (match) {
      try {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (Array.isArray(parsed)) bookedList = parsed;
      } catch {}
    }

    if (!bookedList.includes(eventId)) {
      bookedList.push(eventId);
    }

    document.cookie = `ihyaa_booked_events=${encodeURIComponent(
      JSON.stringify(bookedList),
    )}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {}

  notifyBookingChange();
}

export function useIsEventBooked(eventId: string): boolean {
  return useSyncExternalStore(
    subscribeBookingState,
    () => isEventBooked(eventId),
    () => false,
  );
}

export function getBookedEventIds(): string[] {
  if (typeof window === "undefined") return [];

  const ids = new Set<string>();

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("ihyaa_booked_") && key !== "ihyaa_booked_latest" && key !== "ihyaa_booked_ref") {
        if (localStorage.getItem(key) === "true") {
          ids.add(key.replace("ihyaa_booked_", ""));
        }
      }
    }
  } catch {}

  try {
    const match = document.cookie.match(/(?:^|;\s*)ihyaa_booked_events=([^;]+)/);
    if (match) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => typeof id === "string" && ids.add(id));
      }
    }
  } catch {}

  return Array.from(ids);
}
