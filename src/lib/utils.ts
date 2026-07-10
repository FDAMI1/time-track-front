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
