import { apiFetch, safeJson } from "./api";
import { filenameFromDisposition } from "./disposition";

// Downloads an authenticated file through the API. Throws an Error carrying
// the server's message so callers can show why a download failed.
export async function downloadAuthorized(path: string, token: string | null, fallbackName: string): Promise<string> {
  const res = await apiFetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let message = "Download failed";
    try {
      const body = await safeJson<{ message?: string }>(res);
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition"), fallbackName);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
