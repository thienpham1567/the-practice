import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_READY_ATTEMPT_MS,
  API_READY_BUDGET_MS,
  API_READY_MIN_GAP_MS,
  HEALTH_PATH,
  waitUntilReady,
} from "./api-ready";

function ok(): Response {
  return { ok: true, status: 200 } as Response;
}

function notReady(): Response {
  return { ok: false, status: 503 } as Response;
}

function hangUntilAbort(_url: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

describe("waitUntilReady", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports probe constants", () => {
    expect(API_READY_ATTEMPT_MS).toBe(90_000);
    expect(API_READY_BUDGET_MS).toBe(180_000);
    expect(API_READY_MIN_GAP_MS).toBe(1_000);
    expect(HEALTH_PATH).toBe("/api/health/ready");
  });

  it("returns ready when health is ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    await expect(waitUntilReady({ fetch: fetchImpl })).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledWith("/api/health/ready", expect.objectContaining({
      method: "GET",
      credentials: "include",
    }));
  });

  it("retries after 503 and succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValueOnce(notReady()).mockResolvedValueOnce(ok());
    const pending = waitUntilReady({ fetch: fetchImpl, minGapMs: 1_000 });
    await vi.advanceTimersByTimeAsync(API_READY_MIN_GAP_MS);
    await expect(pending).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("aborts a hung attempt after 90s and retries", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementationOnce(hangUntilAbort).mockResolvedValueOnce(ok());
    const pending = waitUntilReady({ fetch: fetchImpl, minGapMs: 0 });
    await vi.advanceTimersByTimeAsync(API_READY_ATTEMPT_MS);
    await expect(pending).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns failed when the 180s budget is exhausted", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(notReady());
    const pending = waitUntilReady({
      fetch: fetchImpl,
      attemptMs: 1_000,
      budgetMs: 2_000,
      minGapMs: 1_000,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(pending).resolves.toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops when the parent signal aborts", async () => {
    const abort = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(hangUntilAbort);
    const pending = waitUntilReady({ fetch: fetchImpl, signal: abort.signal, minGapMs: 0 });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
