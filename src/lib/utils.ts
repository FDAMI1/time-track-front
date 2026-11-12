import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Builds up-to-two-letter initials from a first/last name, tolerating missing
 * or empty parts (avoids `firstName[0]` crashes when a record is incomplete).
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

// Calendar date (YYYY-MM-DD) on the user's own clock. `toISOString()` converts
// to UTC first, which names the wrong day for several hours every day in any
// time zone away from UTC.
export function localDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "13:25" -> "1:25 PM". Anything that isn't HH:MM is returned as it is.
export function formatTime12(hhmm: string | null | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!match) return hhmm || "";
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}
