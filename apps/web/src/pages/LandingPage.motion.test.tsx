import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANDING_MISTAKES, LANDING_TREND } from "../folio/landing-copy";
import { LandingPage } from "./LandingPage";

// Repo này không auto-cleanup RTL giữa các test; không dọn thì các render
// chồng lên nhau và getByText báo "multiple elements" oan.
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

  it("shows the mistake notebook tallies", () => {
    renderPage();

    for (const tally of LANDING_MISTAKES.tallies) {
      expect(screen.getByText(tally.label)).toBeInTheDocument();
    }
  });

  it("draws the band trend as a real polyline, not an image", () => {
    const { container } = renderPage();

    const line = container.querySelector("polyline.landing-trend-line");
    expect(line).not.toBeNull();
    expect(line!.getAttribute("points")!.split(" ")).toHaveLength(
      LANDING_TREND.bands.length,
    );
  });

  /*
    Nội dung phải có mặt trong DOM bất kể IntersectionObserver có bắn hay không.
    Nếu render nội dung theo state của observer thì máy tìm kiếm và người tắt JS
    thấy một trang trống.
  */
  it("puts every section in the DOM before anything scrolls into view", () => {
    renderPage();

    expect(screen.getByText(LANDING_MISTAKES.kicker)).toBeInTheDocument();
    expect(screen.getByText(LANDING_TREND.kicker)).toBeInTheDocument();
  });
});
