const BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : "/api";

// Default ceiling for a single API call. Without this the browser waits
// indefinitely and the UI sits on a spinner forever (e.g. "Signing in…" with
// no error) whenever the backend is wedged or a DB lock backs up.
const DEFAULT_TIMEOUT_MS = 30_000;
// The backend proxies agent calls that can legitimately take minutes.
const LONG_TIMEOUT_MS = 300_000;

function timeoutFor(path: string, init?: RequestInit): number {
  const override = Number((init as { timeoutMs?: number } | undefined)?.timeoutMs);
  if (Number.isFinite(override) && override > 0) return override;
  if (/\/chat(\/|$)|artifacts/.test(path)) return LONG_TIMEOUT_MS;
  return DEFAULT_TIMEOUT_MS;
}

type TimedInit = RequestInit & { timeoutMs?: number };

// Render free tier sleeps after 15 min idle — first request gets 503/CORS error
// while the service wakes up (~30s). Retry once with delay.
async function fetchWithWakeRetry(url: string, init?: TimedInit): Promise<Response> {
  const ms = timeoutFor(new URL(url, location.origin).pathname, init);
  const { timeoutMs: _ignored, ...rest } = init ?? {};

  const attempt = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...rest, signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
  };

  try {
    const res = await attempt();
    if (res.status === 503 || res.status === 502) {
      await new Promise((r) => setTimeout(r, 8000));
      return attempt();
    }
    return res;
  } catch (err) {
    // An explicit timeout means the server was reached but did not answer in
    // time (or the wake-retry window elapsed). Surface it as a real error so
    // the caller can show one, instead of retrying a dead request forever.
    if ((err as Error)?.name === "AbortError") {
      throw new Error(`API timeout after ${Math.round(ms / 1000)}s — the server did not respond.`);
    }
    // CORS/network error during wake-up — wait and retry once
    await new Promise((r) => setTimeout(r, 8000));
    try {
      return await attempt();
    } catch (retryErr) {
      if ((retryErr as Error)?.name === "AbortError") {
        throw new Error(
          `API timeout after ${Math.round(ms / 1000)}s — is the backend running on :8001?`,
        );
      }
      throw retryErr;
    }
  }
}

export async function apiFetch<T>(path: string, init?: TimedInit): Promise<T> {
  const res = await fetchWithWakeRetry(`${BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}