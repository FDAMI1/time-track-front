const BASE_URL =
  import.meta.env.VITE_API_URL === "http://localhost:5000"
    ? "https://time-track-back.onrender.com"
    : (import.meta.env.VITE_API_URL || "https://time-track-back.onrender.com");
    
console.log("[api] BASE_URL:", BASE_URL);

export { BASE_URL };

export async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  console.log(`[api] status=${res.status} url=${res.url} body(200ch)=${text.slice(0, 200)}`);
  if (text.trimStart().startsWith("<")) {
    console.error("[api] HTML received instead of JSON — likely wrong URL or CORS block");
    throw new Error(`Server returned HTML (status ${res.status}). Check VITE_API_URL and CORS settings.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("[api] JSON parse failed. Raw text:", text.slice(0, 500));
    throw new Error("Invalid JSON response from server");
  }
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  console.log(`[api] ${options.method || "GET"} ${url}`);
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.error(`[api] Network error (Failed to fetch) for ${url}:`, err);
    throw new Error(
      `Network error: cannot reach ${url}. ` +
      `Check VITE_API_URL, CORS headers (allow capacitor://localhost), and internet connection.`
    );
  }
  return res;
}

export async function postJson<T = any>(
  path: string,
  body: unknown,
  token?: string | null,
): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  console.log(`[api] POST ${url}`, body);
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
    console.error(`[api] POST network error for ${url}:`, err);
    throw new Error(
      `Network error: cannot reach ${url}. ` +
      `Check VITE_API_URL and CORS headers (allow capacitor://localhost).`
    );
  }
  return safeJson<T>(res);
}
