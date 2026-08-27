import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProgressSeriesPoint, ProgressSummary } from "../api/progress";
import { ProgressPage } from "./ProgressPage";

vi.mock("../api/progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/progress")>();
  return {
    ...actual,
    getProgress: vi.fn(),
  };
});

vi.mock("../api/auth-store", () => ({
  useAuthStore: () => ({ user: { id: "u1", email: "a@b.c" }, clearSession: vi.fn() }),
}));

import { getProgress } from "../api/progress";

function point(
  overrides: Partial<ProgressSeriesPoint> & Pick<ProgressSeriesPoint, "at" | "level">,
): ProgressSeriesPoint {
  return {
    band: 6.5,
    scores: { task: 7, coherence: 6, lexical: 5, grammar: 7 },
    per100: { passives: 0.8, adverbs: 1.2 },
    ...overrides,
  };
}

function summary(series: ProgressSeriesPoint[]): ProgressSummary {
  return { series, streak: { current: series.length > 0 ? 1 : 0, submittedDates: [] } };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProgressPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProgressPage", () => {
  beforeEach(() => {
    vi.mocked(getProgress).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an empty state with a link to practice when series is empty", async () => {
    vi.mocked(getProgress).mockResolvedValue(summary([]));
    renderPage();

    expect(await screen.findByText(/Sit your first practice paper/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start writing" }).getAttribute("href")).toBe("/practice");
    expect(screen.queryByLabelText("Band over time by level")).toBeNull();
    expect(screen.queryByLabelText("Criteria trends")).toBeNull();
    expect(screen.queryByLabelText("Style trends")).toBeNull();
    expect(screen.queryByLabelText("Level-up suggestion")).toBeNull();
  });

  it("renders multiple level paths and a legend", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 5.5 }),
        point({ at: "2026-08-21T10:00:00.000Z", level: "B2", band: 6 }),
        point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5 }),
      ]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Band over time by level");
    expect(chart.querySelectorAll('polyline[data-level="B1"]')).toHaveLength(1);
    expect(chart.querySelectorAll('circle[data-level="B1"]')).toHaveLength(2);
    expect(chart.querySelectorAll('circle[data-level="B2"]')).toHaveLength(1);
    // Single B2 point → no polyline
    expect(chart.querySelectorAll('polyline[data-level="B2"]')).toHaveLength(0);

    const legend = screen.getByLabelText("Level legend");
    expect(within(legend).getByText("B1")).toBeTruthy();
    expect(within(legend).getByText("B2")).toBeTruthy();
  });

  it("renders a single scored point as a dot without a polyline", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6 })]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Band over time by level");
    expect(chart.querySelectorAll("circle")).toHaveLength(1);
    expect(chart.querySelectorAll("polyline[data-level]")).toHaveLength(0);
  });

  it("labels the weakest criterion over 30 days", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({
          at: "2026-08-20T10:00:00.000Z",
          level: "B1",
          scores: { task: 7, coherence: 6, lexical: 4, grammar: 7 },
        }),
        point({
          at: "2026-08-25T10:00:00.000Z",
          level: "B1",
          scores: { task: 7, coherence: 6, lexical: 5, grammar: 8 },
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByText("yếu nhất 30 ngày: Lexical")).toBeTruthy();
  });

  it("plots style series while skipping null per100 points", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({
          at: "2026-08-20T10:00:00.000Z",
          level: "B1",
          per100: { passives: 0.8, adverbs: 1.2 },
        }),
        point({ at: "2026-08-21T10:00:00.000Z", level: "B1", per100: null }),
        point({
          at: "2026-08-22T10:00:00.000Z",
          level: "B1",
          per100: { passives: 1.0, adverbs: 0.5 },
        }),
      ]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Style trends");
    expect(chart.querySelectorAll('circle[data-series="passives"]')).toHaveLength(2);
    expect(chart.querySelectorAll('circle[data-series="adverbs"]')).toHaveLength(2);
    expect(chart.querySelectorAll('polyline[data-series="passives"]')).toHaveLength(1);
    expect(chart.querySelectorAll('polyline[data-series="adverbs"]')).toHaveLength(1);
  });

  it("shows the level-up stamp only when the verdict is ready", async () => {
    const ready: ProgressSeriesPoint[] = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
    ];
    vi.mocked(getProgress).mockResolvedValue(summary(ready));
    renderPage();

    expect(await screen.findByLabelText("Level-up suggestion")).toBeTruthy();
    expect(screen.getByText("B2")).toBeTruthy();
    expect(screen.getByText(/5 bài B1 gần nhất đều ≥ 6\.5/)).toBeTruthy();

    cleanup();

    vi.mocked(getProgress).mockResolvedValue(
      summary([point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6 })]),
    );
    renderPage();

    expect(await screen.findByLabelText("Band over time by level")).toBeTruthy();
    expect(screen.queryByLabelText("Level-up suggestion")).toBeNull();
    expect(screen.queryByText(/chưa đủ|not ready/i)).toBeNull();
  });
});
