const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");

const CLOUDINARY_IMAGE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!f_auto)/;

// Turns a stored image reference into a URL the browser can load. New images
// are absolute Cloudinary URLs, delivered in the best format and quality the
// browser supports; images uploaded by older versions are paths on the API
// server.
export function assetUrl(url: string | null | undefined, base: string = API_BASE): string {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return `${base}${url}`;
  return url.replace(CLOUDINARY_IMAGE, "$1f_auto,q_auto/");
}
