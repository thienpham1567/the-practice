import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage now={new Date(2026, 7, 26)} />
    </MemoryRouter>,
  );
}

describe("LandingPage motion sections", () => {
  it("opens with the paper marking itself", () => {
    renderPage();

    expect(screen.getByText("will come")).toBeInTheDocument();
  });

  it("is only the hero frame — no below-fold sections", () => {
    renderPage();

    expect(screen.queryByText("Your notebook")).not.toBeInTheDocument();
    expect(screen.queryByText("Eight weeks")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Band scores rising over eight weeks")).not.toBeInTheDocument();
  });
});
