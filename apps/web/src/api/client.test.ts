import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth-store";
import { tryRefreshSession } from "./client";
import { hasSessionHint, setSessionHint } from "./session-hint";

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
});

function answer(status: number, body?: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
    ),
  );
}

describe("tryRefreshSession", () => {
  afterEach(() => {
    memory.clear();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("treats 204 (no cookie) as signed out and drops the hint", async () => {
    setSessionHint(true);
    answer(204);
    expect(await tryRefreshSession()).toBe(false);
    expect(hasSessionHint()).toBe(false);
  });

  it("drops the hint when the session has expired", async () => {
    setSessionHint(true);
    answer(401, { message: "Unauthorized" });
    expect(await tryRefreshSession()).toBe(false);
    expect(hasSessionHint()).toBe(false);
  });

  it("keeps the hint when the API is down, so the next visit still waits", async () => {
    setSessionHint(true);
    answer(502);
    expect(await tryRefreshSession()).toBe(false);
    expect(hasSessionHint()).toBe(true);
  });

  it("restores the session and sets the hint", async () => {
    answer(200, { accessToken: "token", user: { id: "u1", email: "a@b.c" } });
    expect(await tryRefreshSession()).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("token");
    expect(hasSessionHint()).toBe(true);
  });
});
