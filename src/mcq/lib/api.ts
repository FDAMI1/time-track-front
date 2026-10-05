import { useMemo } from "react";
import { apiFetch, BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// Thin JSON/FormData client over the app's apiFetch. Errors surface the
// backend's `{ message }` so pages can toast them directly.
export function createMcqApi(token: string | null) {
  const send = <T>(method: string, url: string, body?: unknown): Promise<T> => {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    return apiFetch(url, {
      method,
      headers: {
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isForm ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
    }).then((res) => parse<T>(res));
  };

  return {
    get: <T>(url: string) => send<T>("GET", url),
    post: <T>(url: string, body?: unknown) => send<T>("POST", url, body),
    put: <T>(url: string, body?: unknown) => send<T>("PUT", url, body),
    patch: <T>(url: string, body?: unknown) => send<T>("PATCH", url, body),
    delete: <T>(url: string) => send<T>("DELETE", url),
  };
}

export type McqApi = ReturnType<typeof createMcqApi>;

export function useMcqApi(): McqApi {
  const { token } = useAuth();
  return useMemo(() => createMcqApi(token), [token]);
}

export async function downloadFile(url: string, token: string | null) {
  const res = await apiFetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = (await res.json()).message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="?([^";\n]+)"?/);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = match?.[1] || "report";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

export function screenshotUrl(fileId: string, token: string | null) {
  const url = `${BASE_URL}/api/mcq/screenshots/${fileId}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:([^;]+)/)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
