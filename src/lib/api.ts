const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Debug logging is compiled out of production builds (Vite tree-shakes the
// `import.meta.env.DEV` branch). This prevents leaking tokens, request bodies,
// and response payloads into end-user consoles.
const isDev = import.meta.env.DEV;
const debug = (...args: unknown[]) => {
  if (isDev) console.log("[api]", ...args);
};

export { BASE_URL };

function resolveUrl(path: string): string {
  return path.startsWith("http") ? path : `${BASE_URL}${path}`;
}

function networkError(): Error {
  return new Error("Network error: cannot reach the server. Check your connection and try again.");
}

export async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  debug(`status=${res.status} url=${res.url}`);
  if (text.trimStart().startsWith("<")) {
    throw new Error(`Server returned an unexpected response (status ${res.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    debug("JSON parse failed:", text.slice(0, 500));
    throw new Error("Invalid response from server");
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = resolveUrl(path);
  debug(`${options.method || "GET"} ${url}`);
  try {
    return await fetch(url, options);
  } catch (err) {
    debug(`Network error for ${url}:`, err);
    throw networkError();
  }
}

export async function postJson<T = any>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<T> {
  const url = resolveUrl(path);
  debug(`POST ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    debug(`POST network error for ${url}:`, err);
    throw networkError();
  }
  return safeJson<T>(res);
}
