const BASE_URL = import.meta.env.VITE_API_URL || "";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.error(`[apiFetch] Network error for ${url}:`, err);
    throw err;
  }
  if (!res.ok) {
    const text = await res.clone().text();
    if (text.trimStart().startsWith("<")) {
      console.error(`[apiFetch] HTML response (non-JSON) from ${url}:`, text.slice(0, 200));
      throw new Error(`Server returned HTML instead of JSON (status ${res.status}). Check VITE_API_URL.`);
    }
  }
  return res;
}

export { BASE_URL };
