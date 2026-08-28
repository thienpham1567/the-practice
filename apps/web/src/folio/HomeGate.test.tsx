import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../api/auth-store";
import { HomeGate } from "./HomeGate";

describe("HomeGate", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("shows One moment while restoring", () => {
    useAuthStore.setState({ status: "loading", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.getByText("One moment…")).toBeTruthy();
    expect(screen.queryByText("Sit the paper. Take the turn.")).toBeNull();
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
