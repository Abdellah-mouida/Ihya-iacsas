/** Removes legacy, unscoped booking markers from browsers after sign-out. */
export function clearLegacyBookingState(): void {
  if (typeof window === "undefined") return;

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index--) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("ihyaa_booked_") || key?.startsWith("ihyaa_booking_ref_")) {
        window.localStorage.removeItem(key);
      }
    }
    window.localStorage.removeItem("ihyaa_booked_ref");
  } catch {
    // Storage may be disabled; new booking UI never reads these values.
  }

  try {
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.trim().split("=", 1)[0];
      if (name.startsWith("ihyaa_booked_") || name.startsWith("ihyaa_booking_ref_")) {
        document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
      }
    }
  } catch {
    // Cookie cleanup is best effort; booking state is derived from the database.
  }
}
