import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApiReady } from "./useApiReady";

describe("useApiReady", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("is checking until health returns ok, then ready", async () => {
    const { result } = renderHook(() => useApiReady());
    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("retry starts a new probe from checking", async () => {
    const fetchImpl = vi.mocked(fetch);
    fetchImpl
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const { result } = renderHook(() => useApiReady());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("does not throw if unmounted while a probe is in flight", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const { unmount } = renderHook(() => useApiReady());
    unmount();
  });
});
