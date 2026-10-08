/**
 * Utilities for event date/time parsing and automatic status classification.
 */

function normalizeDigits(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export type ParsedEventTimes = {
  startDateTime: Date;
  endDateTime: Date;
  hasSpecificTime: boolean;
};

/**
 * Parses event date and time string into start and end Date objects,
 * accounting for 24h, 12h AM/PM, Moroccan "18h30" format, Arabic digits,
 * and text descriptions.
 */
export function parseEventDateTime(
  rawDate: Date | string | number,
  rawTime?: string | null,
  durationHours = 3,
): ParsedEventTimes {
  const d = new Date(rawDate);
  if (isNaN(d.getTime())) {
    const epoch = new Date(0);
    return { startDateTime: epoch, endDateTime: epoch, hasSpecificTime: false };
  }

  // Extract calendar year, month (0-11), and day.
  // When a Date is created from "YYYY-MM-DD", it defaults to UTC midnight.
  // Use UTC values if it's exact UTC midnight to prevent timezone day-shift,
  // otherwise use local values if it was instantiated with local time.
  const isUtcMidnight =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;

  const year = isUtcMidnight ? d.getUTCFullYear() : d.getFullYear();
  const month = isUtcMidnight ? d.getUTCMonth() : d.getMonth();
  const day = isUtcMidnight ? d.getUTCDate() : d.getDate();

  let hours: number | null = null;
  let minutes = 0;
  let hasSpecificTime = false;

  if (rawTime && typeof rawTime === "string") {
    const cleanTime = normalizeDigits(rawTime.trim().toLowerCase());

    // 1. Try 12-hour AM/PM: e.g. "6:30 pm", "6 pm", "06:00 am"
    const ampmMatch = cleanTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
      const isPm = ampmMatch[3].toLowerCase() === "pm";
      if (h === 12) {
        h = isPm ? 12 : 0;
      } else if (isPm) {
        h += 12;
      }
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        hours = h;
        minutes = m;
        hasSpecificTime = true;
      }
    }

    // 2. Try French / Moroccan "18h" or "18h30" format
    if (hours === null) {
      const hFormatMatch = cleanTime.match(/(\d{1,2})h(\d{2})?/i);
      if (hFormatMatch) {
        const h = parseInt(hFormatMatch[1], 10);
        const m = hFormatMatch[2] ? parseInt(hFormatMatch[2], 10) : 0;
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          hours = h;
          minutes = m;
          hasSpecificTime = true;
        }
      }
    }

    // 3. Try standard 24-hour HH:MM: e.g. "18:00", "09:30"
    if (hours === null) {
      const standardMatch = cleanTime.match(/(\d{1,2}):(\d{2})/);
      if (standardMatch) {
        const h = parseInt(standardMatch[1], 10);
        const m = parseInt(standardMatch[2], 10);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          hours = h;
          minutes = m;
          hasSpecificTime = true;
        }
      }
    }
  }

  // If time was not parsed from string, but d itself has hours/minutes set
  if (hours === null && !isUtcMidnight) {
    hours = d.getHours();
    minutes = d.getMinutes();
    hasSpecificTime = hours !== 0 || minutes !== 0;
  }

  if (hours !== null) {
    // Specific time is known
    const startDateTime = new Date(year, month, day, hours, minutes, 0, 0);
    // End time is after the event concludes (default +durationHours or end of that day)
    const endDateTime = new Date(
      startDateTime.getTime() + durationHours * 60 * 60 * 1000,
    );
    return { startDateTime, endDateTime, hasSpecificTime };
  }

  // No specific time known (e.g. "بعد صلاة العشاء" or unspecified)
  // Starts at the start of that day, ends at the end of that day (23:59:59.999)
  const startDateTime = new Date(year, month, day, 0, 0, 0, 0);
  const endDateTime = new Date(year, month, day, 23, 59, 59, 999);
  return { startDateTime, endDateTime, hasSpecificTime: false };
}

/**
 * Determines whether an event has ended based on its date and time.
 * If referenceNow is passed, checks against that timestamp (useful for testing).
 */
export function isEventEnded(
  rawDate: Date | string | number,
  rawTime?: string | null,
  referenceNow?: Date,
): boolean {
  const now = referenceNow || new Date();
  const { endDateTime } = parseEventDateTime(rawDate, rawTime);
  return now.getTime() > endDateTime.getTime();
}

/**
 * Determines whether registration for an event is currently open.
 * An event is open for registration if:
 * 1. bookingOpen flag is true (if provided)
 * 2. The event start date/time has not already passed
 */
export function isEventRegistrationOpen(
  rawDate: Date | string | number,
  rawTime?: string | null,
  bookingOpenFlag = true,
  referenceNow?: Date,
): boolean {
  if (!bookingOpenFlag) return false;
  const now = referenceNow || new Date();
  const { startDateTime } = parseEventDateTime(rawDate, rawTime);
  return now.getTime() < startDateTime.getTime();
}
