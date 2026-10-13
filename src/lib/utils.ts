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
