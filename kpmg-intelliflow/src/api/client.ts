const BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

// Render free tier sleeps after 15 min idle — first request gets 503/CORS error
// while the service wakes up (~30s). Retry once with delay.
async function fetchWithWakeRetry(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (res.status === 503 || res.status === 502) {
      await new Promise((r) => setTimeout(r, 8000));
      return fetch(url, init);
    }
    return res;
  } catch {
    // CORS/network error during wake-up — wait and retry
    await new Promise((r) => setTimeout(r, 8000));
    return fetch(url, init);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithWakeRetry(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
