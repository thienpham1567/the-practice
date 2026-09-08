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
    preserveAspectRatio="none" kéo SVG lệch trục. <circle> trong đó thành elip
    dẹt; stroke-dasharray + non-scaling-stroke cắt polyline thành từng nét.
    Chấm phải nằm ngoài SVG bị stretch, hoặc SVG không stretch.
  */
  it("does not put circular marks inside a stretched trend svg", () => {
    const { container } = renderPage();
    const svg = container.querySelector(
      'svg[aria-label="Band scores rising over eight weeks"]',
    );
    const stretched = svg?.getAttribute("preserveAspectRatio") === "none";
    const circles = svg?.querySelectorAll("circle").length ?? 0;
    expect(stretched && circles > 0).toBe(false);
    expect(container.querySelectorAll("[data-trend-dot]")).toHaveLength(
      LANDING_TREND.bands.length,
    );
  });

  it("keeps the trend svg unstretched so the line can draw", () => {
    const { container } = renderPage();
    const svg = container.querySelector(
      'svg[aria-label="Band scores rising over eight weeks"]',
    );
    const line = container.querySelector("polyline.landing-trend-line");
    expect(svg?.getAttribute("preserveAspectRatio")).not.toBe("none");
    expect(line?.getAttribute("vectorEffect")).not.toBe("non-scaling-stroke");
    expect(line?.getAttribute("pathLength")).toBe("100");
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
