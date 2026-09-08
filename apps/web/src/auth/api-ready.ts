export type ApiReadyStatus = "checking" | "ready" | "failed";

export const API_READY_ATTEMPT_MS = 90_000;
export const API_READY_BUDGET_MS = 180_000;
export const API_READY_MIN_GAP_MS = 1_000;
export const HEALTH_PATH = "/api/health/ready";

export async function waitUntilReady(options: {
  fetch?: typeof fetch;
  signal?: AbortSignal;
  attemptMs?: number;
  budgetMs?: number;
  minGapMs?: number;
} = {}): Promise<"ready" | "failed"> {
  const fetchImpl = options.fetch ?? fetch;
  const attemptMs = options.attemptMs ?? API_READY_ATTEMPT_MS;
  const budgetMs = options.budgetMs ?? API_READY_BUDGET_MS;
  const minGapMs = options.minGapMs ?? API_READY_MIN_GAP_MS;
  const parent = options.signal;
  const started = Date.now();

  while (Date.now() - started < budgetMs) {
    if (parent?.aborted) throw new DOMException("Aborted", "AbortError");

    const remaining = budgetMs - (Date.now() - started);
    const timeoutMs = Math.min(attemptMs, remaining);
    if (timeoutMs <= 0) break;

    const attemptStart = Date.now();
    const attempt = new AbortController();
    const onParentAbort = () => attempt.abort();
    parent?.addEventListener("abort", onParentAbort);
    if (parent?.aborted) attempt.abort();
    const timer = setTimeout(() => attempt.abort(), timeoutMs);

    try {
      const response = await fetchImpl(HEALTH_PATH, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: attempt.signal,
      });
      if (response.ok) return "ready";
    } catch (error) {
      if (parent?.aborted) throw new DOMException("Aborted", "AbortError");
      // network errors and attempt timeouts fall through to retry
    } finally {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    }

    const elapsed = Date.now() - attemptStart;
    const gap = Math.max(0, minGapMs - elapsed);
    const budgetLeft = budgetMs - (Date.now() - started);
    if (gap > 0 && budgetLeft > 0) {
      await sleep(Math.min(gap, budgetLeft), parent);
    }
  }

  if (parent?.aborted) throw new DOMException("Aborted", "AbortError");
  return "failed";
}

function sleep(ms: number, parent?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (parent?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      parent?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    parent?.addEventListener("abort", onAbort);
  });
}
