import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../api/auth-store";
import { setSessionHint } from "../api/session-hint";
import { HomeGate } from "./HomeGate";

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

describe("HomeGate", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("shows One moment while restoring a known session", () => {
    setSessionHint(true);
    useAuthStore.setState({ status: "loading", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.getByText("One moment…")).toBeTruthy();
    expect(screen.queryByText("Sit the paper. Take the turn.")).toBeNull();
  });

  it("shows the landing at once for a first-time visitor", () => {
    useAuthStore.setState({ status: "loading", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.queryByText("One moment…")).toBeNull();
    expect(screen.getByText("Sit the paper. Take the turn.")).toBeTruthy();
  });

  it("shows the landing when ready and signed out", () => {
    useAuthStore.setState({ status: "ready", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sit the paper. Take the turn.")).toBeTruthy();
  });
});
