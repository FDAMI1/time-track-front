export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Asks the browser for the current position. Rejects with a message the user
// can act on (permission denied, unavailable, timed out).
export function getCurrentCoordinates(timeoutMs = 12000): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device does not support location. Use a device that does, or ask your admin."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => {
        const reason =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow location access for this site and try again."
            : err.code === err.TIMEOUT
              ? "Getting your location took too long. Check your signal and try again."
              : "Your location could not be determined. Try again.";
        reject(new Error(reason));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 }
    );
  });
}

// Whether this user must prove their location, mirroring the server rule: a
// per-user override wins, otherwise the organization setting applies, and
// nothing is enforced without a configured organization location.
export function isLocationRequired(
  user: { role?: string; locationRestrictionEnabled?: boolean | null } | null | undefined,
  org: { isLocationRestrictionEnabled?: boolean; location?: { latitude?: number; longitude?: number } } | null | undefined
): boolean {
  if (!user || ["superadmin", "org_admin"].includes(user.role || "")) return false;
  const hasPoint = org?.location?.latitude != null && org?.location?.longitude != null;
  if (!hasPoint) return false;
  if (user.locationRestrictionEnabled === true) return true;
  if (user.locationRestrictionEnabled === false) return false;
  return !!org?.isLocationRestrictionEnabled;
}
