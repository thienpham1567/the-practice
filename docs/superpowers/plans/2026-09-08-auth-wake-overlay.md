# Auth Wake Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/login` and `/register`, block the form behind an editorial overlay until `GET /api/health/ready` returns 200, so a sleeping Render API is visible instead of a hung submit.

**Architecture:** A pure `waitUntilReady()` loop probes health with a 90s per-attempt abort and a 180s budget. `useApiReady` wraps it for React. `AuthWakeOverlay` is presentational (copy + hairline + Retry). `AuthPage` dims and `inert`s everything below the heading until `ready`. No new API route; Google Sign-In keeps booting in the background.

**Tech Stack:** React 18 + Vite (`apps/web`), existing `/api` rewrite, Vitest + Testing Library, CSS keyframes in `apps/web/src/index.css`.

**Spec:** `docs/superpowers/specs/2026-09-08-auth-wake-overlay-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| Create `apps/web/src/auth/api-ready.ts` | `waitUntilReady` + timing constants. No React. |
| Create `apps/web/src/auth/api-ready.test.ts` | Probe loop: 200, 503 retry, hung abort, budget, parent abort |
| Create `apps/web/src/auth/useApiReady.ts` | `{ status, retry }`. Starts probe on mount. |
| Create `apps/web/src/auth/useApiReady.test.tsx` | checking → ready; retry; unmount does not throw |
| Create `apps/web/src/auth/AuthWakeOverlay.tsx` | Overlay UI from `status` + `onRetry` |
| Create `apps/web/src/auth/AuthWakeOverlay.test.tsx` | Copy at 0s / 8s, failed + Try again, retry focus |
| Modify `apps/web/src/index.css` | `.auth-wake-rule` keyframes; reduced-motion freeze |
| Modify `apps/web/src/auth/AuthPage.tsx` | Wire hook + overlay; inert region below heading |
| Modify `apps/web/src/auth/AuthPage.test.tsx` | Mock hook as `ready` by default; overlay cases |

Do not change `apps/api`, `render.yaml`, Google Sign-In, or `apiJson`.

---

### Task 1: `waitUntilReady` probe loop

**Files:**
- Create: `apps/web/src/auth/api-ready.ts`
- Create: `apps/web/src/auth/api-ready.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_READY_ATTEMPT_MS,
  API_READY_BUDGET_MS,
  API_READY_MIN_GAP_MS,
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
    await vi.advanceTimersByTimeAsync(API_READY_BUDGET_MS);
    await expect(pending).resolves.toBe("failed");
  });

  it("stops when the parent signal aborts", async () => {
    const abort = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(hangUntilAbort);
    const pending = waitUntilReady({ fetch: fetchImpl, signal: abort.signal, minGapMs: 0 });
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/api-ready.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```ts
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
    const timer = setTimeout(() => attempt.abort(), timeoutMs);

    try {
      const response = await fetchImpl(HEALTH_PATH, {
        method: "GET",
        credentials: "include",
        signal: attempt.signal,
      });
      if (response.ok) return "ready";
    } catch (error) {
      if (parent?.aborted) throw new DOMException("Aborted", "AbortError");
      if (!(error instanceof Error && error.name === "AbortError")) {
        // network error: fall through to retry
      }
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
    const timer = setTimeout(resolve, ms);
    parent?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
```

`minGapMs` is a 1s floor after a fast 503 so the loop cannot spin. A hung attempt already burned up to 90s, so `gap` is 0 and the next try starts immediately.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/api-ready.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/api-ready.ts apps/web/src/auth/api-ready.test.ts
git commit -m "Probe /api/health/ready until the API desk is up."
```

---

### Task 2: `useApiReady` hook

**Files:**
- Create: `apps/web/src/auth/useApiReady.ts`
- Create: `apps/web/src/auth/useApiReady.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
import { cleanup, renderHook, waitFor } from "@testing-library/react";
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

    result.current.retry();
    await waitFor(() => expect(result.current.status).toBe("checking"));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/useApiReady.test.tsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Write the hook**

```ts
import { useCallback, useEffect, useState } from "react";
import { waitUntilReady, type ApiReadyStatus } from "./api-ready";

export type { ApiReadyStatus };

export function useApiReady(): {
  status: ApiReadyStatus;
  retry: () => void;
} {
  const [status, setStatus] = useState<ApiReadyStatus>("checking");
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    setStatus("checking");
    void waitUntilReady({ signal: abort.signal })
      .then((result) => {
        if (!abort.signal.aborted) setStatus(result);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        if (!abort.signal.aborted) setStatus("failed");
      });
    return () => abort.abort();
  }, [generation]);

  const retry = useCallback(() => {
    setGeneration((n) => n + 1);
  }, []);

  return { status, retry };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/useApiReady.test.tsx`

Expected: PASS

If the retry test flakes because `retry()` does not paint `checking` before the second fetch resolves, keep `await waitFor` on call count 2 and `status === "ready"`; do not add fake delays in production.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/useApiReady.ts apps/web/src/auth/useApiReady.test.tsx
git commit -m "Expose API wake status to the auth page."
```

---

### Task 3: Overlay UI + hairline

**Files:**
- Create: `apps/web/src/auth/AuthWakeOverlay.tsx`
- Create: `apps/web/src/auth/AuthWakeOverlay.test.tsx`
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Write the failing tests**

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthWakeOverlay } from "./AuthWakeOverlay";

describe("AuthWakeOverlay", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("says One moment… while checking", () => {
    render(<AuthWakeOverlay status="checking" onRetry={() => undefined} />);
    expect(screen.getByRole("status").textContent).toBe("One moment…");
    expect(document.querySelector(".auth-wake-rule")).toBeTruthy();
  });

  it("shifts copy after 8 seconds of checking", () => {
    vi.useFakeTimers();
    render(<AuthWakeOverlay status="checking" onRetry={() => undefined} />);
    vi.advanceTimersByTime(8_000);
    expect(screen.getByRole("status").textContent).toBe(
      "The desk is waking. This can take a minute.",
    );
  });

  it("shows Try again when failed and focuses it", () => {
    render(<AuthWakeOverlay status="failed" onRetry={() => undefined} />);
    const button = screen.getByRole("button", { name: "Try again" });
    expect(screen.getByRole("status").textContent).toBe("The desk isn't answering.");
    expect(document.activeElement).toBe(button);
  });

  it("calls onRetry from Try again", () => {
    const onRetry = vi.fn();
    render(<AuthWakeOverlay status="failed" onRetry={onRetry} />);
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthWakeOverlay.test.tsx`

Expected: FAIL (module not found)

- [ ] **Step 3: Write the overlay**

```tsx
import { useEffect, useRef, useState } from "react";
import type { ApiReadyStatus } from "./api-ready";

export const WAKE_COPY_SHIFT_MS = 8_000;
export const WAKE_COPY_WAIT = "One moment…";
export const WAKE_COPY_SLOW = "The desk is waking. This can take a minute.";
export const WAKE_COPY_FAIL = "The desk isn't answering.";

export function AuthWakeOverlay({
  status,
  onRetry,
}: {
  status: Exclude<ApiReadyStatus, "ready">;
  onRetry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== "checking") return;
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), WAKE_COPY_SHIFT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === "failed") retryRef.current?.focus();
  }, [status]);

  return (
    <div
      data-testid="auth-wake-overlay"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--color-paper)_82%,transparent)] px-6"
    >
      {status === "checking" && <div className="auth-wake-rule mb-4" aria-hidden="true" />}
      <p
        role="status"
        aria-live="polite"
        className="text-center font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft"
      >
        {status === "failed" ? WAKE_COPY_FAIL : slow ? WAKE_COPY_SLOW : WAKE_COPY_WAIT}
      </p>
      {status === "failed" && (
        <button
          ref={retryRef}
          type="button"
          onClick={onRetry}
          className="mt-5 font-mono text-sm uppercase tracking-[0.15em] text-vermilion underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS after `@keyframes stamp-in` (the block that already exists near the top of `apps/web/src/index.css`)**

```css
@keyframes auth-wake-rule {
  0% {
    transform: scaleX(0.14);
    opacity: 0.35;
  }
  50% {
    transform: scaleX(1);
    opacity: 1;
  }
  100% {
    transform: scaleX(0.14);
    opacity: 0.35;
  }
}

.auth-wake-rule {
  height: 1px;
  width: 6.5rem;
  transform-origin: center;
  background-color: var(--color-vermilion);
  animation: auth-wake-rule 2.8s ease-in-out infinite;
}
```

Inside the existing `@media (prefers-reduced-motion: reduce)` block that already lists `.auth-ambient-ink` (around line 238), add `.auth-wake-rule` to the `animation: none` list, and after that list add:

```css
  .auth-wake-rule {
    transform: scaleX(1);
    opacity: 0.55;
  }
```

- [ ] **Step 5: Run overlay tests**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthWakeOverlay.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth/AuthWakeOverlay.tsx apps/web/src/auth/AuthWakeOverlay.test.tsx apps/web/src/index.css
git commit -m "Show an editorial wait overlay while the API wakes."
```

---

### Task 4: Wire overlay into AuthPage

**Files:**
- Modify: `apps/web/src/auth/AuthPage.tsx`
- Modify: `apps/web/src/auth/AuthPage.test.tsx`

- [ ] **Step 1: Mock `useApiReady` as `ready` so existing tests stay green, then add overlay tests**

In `apps/web/src/auth/AuthPage.test.tsx`, next to the Google mock, add:

```ts
const apiReady = {
  status: "ready" as "checking" | "ready" | "failed",
  retry: vi.fn(),
};

vi.mock("./useApiReady", () => ({
  useApiReady: () => apiReady,
}));
```

In `beforeEach`, reset:

```ts
apiReady.status = "ready";
apiReady.retry.mockReset();
```

Add these tests inside `describe("AuthPage")`:

```tsx
  it("covers the form with the wake overlay while the API is checking", () => {
    apiReady.status = "checking";
    renderAuth("register");
    expect(screen.getByTestId("auth-wake-overlay")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("One moment…");
    expect(screen.getByRole("heading", { name: "Begin practice" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Day" }).closest("[inert]")).toBeNull();
    expect(screen.getByRole("button", { name: "Create account" }).closest("[inert]")).toBeTruthy();
  });

  it("does not submit while the overlay is up", () => {
    apiReady.status = "checking";
    renderAuth();
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(apiJson).not.toHaveBeenCalled();
  });

  it("hides the overlay once the API is ready", () => {
    apiReady.status = "ready";
    renderAuth();
    expect(screen.queryByTestId("auth-wake-overlay")).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" }).closest("[inert]")).toBeNull();
  });

  it("keeps the form blocked on failed and retries from Try again", () => {
    apiReady.status = "failed";
    renderAuth();
    expect(screen.getByRole("status").textContent).toBe("The desk isn't answering.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(apiReady.retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sign in" }).closest("[inert]")).toBeTruthy();
  });

  it("sets aria-busy on the sheet only while checking", () => {
    apiReady.status = "checking";
    const { container } = renderAuth();
    expect(container.querySelector(".auth-sheet")?.getAttribute("aria-busy")).toBe("true");
    cleanup();
    apiReady.status = "failed";
    const failed = renderAuth();
    expect(failed.container.querySelector(".auth-sheet")?.getAttribute("aria-busy")).toBeNull();
  });
```

- [ ] **Step 2: Run AuthPage tests — existing ones should still pass; new ones FAIL (no overlay)**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthPage.test.tsx`

Expected: existing tests PASS; new tests FAIL (cannot find `auth-wake-overlay` / `useApiReady`)

- [ ] **Step 3: Wire AuthPage**

Add imports:

```ts
import { AuthWakeOverlay } from "./AuthWakeOverlay";
import { useApiReady } from "./useApiReady";
```

Inside `AuthPage`, after `formBusy`:

```ts
  const api = useApiReady();
  const blocked = api.status !== "ready";
```

Guard submit:

```ts
    if (formBusy || blocked) return;
```

Replace the sheet body so heading stays outside the overlay, everything below is `inert` when blocked:

```tsx
      <div
        className="auth-sheet relative z-10 px-7 py-9 sm:px-9 sm:py-11"
        aria-busy={api.status === "checking" ? true : undefined}
      >
      <div className="animate-fade-up" style={{ animationDelay: "40ms" }}>
        <BrandLockup to="/" size="xl" />
        <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.heading}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">{copy.lede}</p>
      </div>

      <div className="relative mt-10">
        <div
          inert={blocked ? true : undefined}
          className={blocked ? "pointer-events-none opacity-40" : undefined}
        >
          <form
            onSubmit={(event) => void submit(event)}
            className="animate-fade-up space-y-5"
            style={{ animationDelay: "90ms" }}
          >
            {/* existing fields, alert, submit button unchanged */}
          </form>

          {/* existing Google block, switch paragraph, Back to the editor — unchanged, still inside this inert wrapper */}
        </div>
        {blocked && api.status !== "ready" && (
          <AuthWakeOverlay status={api.status} onRetry={api.retry} />
        )}
      </div>
      </div>
```

Keep ThemeToggle where it is (`absolute right-6 top-6` on `main`, outside the sheet). Do not wrap it in `inert`.

Move `mt-10` off the form (it now lives on the relative wrapper). Google `mt-8`, switch `mt-6`, back link `mt-10` stay as they are.

- [ ] **Step 4: Run AuthPage tests**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthPage.test.tsx`

Expected: PASS

If `closest("[inert]")` fails because React 18 serializes `inert=""` and jsdom does not match the attribute selector, assert `expect((screen.getByRole("button", { name: "Create account" }).closest("div[class]") as HTMLElement).hasAttribute("inert")).toBe(true)` on the wrapper via `screen.getByTestId` instead: add `data-testid="auth-form-block"` to the inert div and query that.

- [ ] **Step 5: Run the related auth suite**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/auth/AuthPage.tsx apps/web/src/auth/AuthPage.test.tsx
git commit -m "Block the auth form behind the wake overlay until the API is ready."
```

---

### Task 5: Visual check

**Files:** none new. Local `/login` and `/register`.

- [ ] **Step 1: Confirm typecheck**

Run: `pnpm --filter @writing-helper/web typecheck`

Expected: exit 0

- [ ] **Step 2: Browser**

With the API up: overlay should flash at most briefly (health is fast), then the form is usable; Google still appears.

To see the overlay without waiting on Render: in DevTools, block `**/api/health/ready` (or throttle Offline after load-start). Overlay stays, heading readable, form dim, Theme toggle still works. After 8s copy changes. Restore network: if the probe is still in flight it may still be waiting on the aborted request until 90s; use Try again after switching the mock to failed, or reload with API healthy.

Light + dark, desktop + a narrow viewport: scrim readable, vermilion hairline present. `prefers-reduced-motion: reduce`: hairline static.

- [ ] **Step 3: No extra commit unless CSS values were tuned.** If you tuned overlay opacity / hairline timing, commit:

```bash
git add apps/web/src/index.css apps/web/src/auth/AuthWakeOverlay.tsx
git commit -m "Tune the auth wake overlay contrast and hairline."
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Overlay on `/login` + `/register` only | Task 4 |
| Ghost form, heading readable | Task 4 |
| Gate `GET /api/health/ready` | Task 1 |
| 90s abort / 180s budget / retry | Task 1 |
| 1s floor after fast 503 (no spin) | Task 1 (`minGapMs`) |
| Copy 0s / 8s / failed / Try again | Task 3 |
| `inert` below heading; Theme toggle free | Task 4 |
| `role="status"` + `aria-busy` while checking | Tasks 3–4 |
| Retry focus on failed | Task 3 |
| No auto-focus email on ready | Task 4 (no focus() on ready) |
| Reduced-motion hairline | Task 3 CSS |
| Google still boots behind overlay | Task 4 (do not gate `useGoogleSignIn`) |
| No API route / no Render plan change | File map |

## Placeholder / type check

- Types: `ApiReadyStatus` is `"checking" | "ready" | "failed"` in `api-ready.ts`; overlay props exclude `"ready"`; hook returns the same union.
- `HEALTH_PATH` is `"/api/health/ready"` (web rewrite), not `/health/ready`.
- Overlay is not mounted when `ready`.
- `retry` resets via `generation` so the 8s copy timer restarts (overlay `useEffect` on `status`).
