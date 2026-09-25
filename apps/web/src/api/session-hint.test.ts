import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "./auth-store";
import { hasSessionHint } from "./session-hint";

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

describe("session hint", () => {
  afterEach(() => {
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("is set by signing in and cleared by signing out", () => {
    expect(hasSessionHint()).toBe(false);
    useAuthStore.getState().setSession("token", { id: "u1", email: "a@b.c" });
    expect(hasSessionHint()).toBe(true);
    useAuthStore.getState().clearSession();
    expect(hasSessionHint()).toBe(false);
  });
});
