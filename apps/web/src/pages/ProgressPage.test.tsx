import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ProgressSeriesPoint,
  ProgressSummary,
  SpeakingProgressPoint,
} from "../api/progress";
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

function speakingPoint(
  overrides: Partial<SpeakingProgressPoint> & Pick<SpeakingProgressPoint, "at" | "level">,
): SpeakingProgressPoint {
  return {
    band: 6,
    wordsPerMinute: 110,
    ...overrides,
  };
}

function summary(
  series: ProgressSeriesPoint[],
  speaking: SpeakingProgressPoint[] = [],
): ProgressSummary {
  return {
    series,
    streak: { current: series.length > 0 ? 1 : 0, submittedDates: [] },
    speaking: { series: speaking },
  };
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

  it("shows an empty state with links when both series are empty", async () => {
    vi.mocked(getProgress).mockResolvedValue(summary([]));
    renderPage();

    expect(await screen.findByText(/Sit your first practice paper or talk/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start writing" }).getAttribute("href")).toBe("/practice");
    expect(screen.getByRole("link", { name: "Start speaking" }).getAttribute("href")).toBe(
      "/speaking",
    );
    expect(screen.queryByLabelText("Band over time by level")).toBeNull();
    expect(screen.queryByLabelText("Speaking progress")).toBeNull();
  });

  it("renders writing charts without merging speaking points into the band chart", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary(
        [
          point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 5.5 }),
          point({ at: "2026-08-21T10:00:00.000Z", level: "B2", band: 6 }),
          point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5 }),
        ],
        [speakingPoint({ at: "2026-08-22T12:00:00.000Z", level: "B1", band: 7 })],
      ),
    );
    renderPage();

    const writingChart = await screen.findByLabelText("Band over time by level");
    expect(writingChart.querySelectorAll('polyline[data-level="B1"]')).toHaveLength(1);
    expect(writingChart.querySelectorAll('circle[data-level="B1"]')).toHaveLength(2);
    expect(writingChart.querySelectorAll('circle[data-level="B2"]')).toHaveLength(1);
    // Speaking point must not appear on the writing chart (would be a 3rd B1 circle)
    expect(writingChart.querySelectorAll('circle[data-level="B1"]')).not.toHaveLength(3);

    const speakingSection = screen.getByLabelText("Speaking progress");
    expect(within(speakingSection).getByLabelText("Speaking band over time")).toBeTruthy();
    expect(
      within(speakingSection).getByLabelText("Speaking band over time").querySelectorAll(
        'circle[data-level="B1"]',
      ),
    ).toHaveLength(1);
  });

  it("renders speaking-only progress with band and WPM charts", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary(
        [],
        [
          speakingPoint({
            at: "2026-08-20T10:00:00.000Z",
            level: "B1",
            band: 5.5,
            wordsPerMinute: 100,
          }),
          speakingPoint({
            at: "2026-08-22T10:00:00.000Z",
            level: "B1",
            band: 6.5,
            wordsPerMinute: 130,
          }),
        ],
      ),
    );
    renderPage();

    expect(await screen.findByLabelText("Speaking progress")).toBeTruthy();
    expect(screen.queryByLabelText("Band over time by level")).toBeNull();
    expect(screen.queryByLabelText("Writing progress")).toBeNull();

    const band = screen.getByLabelText("Speaking band over time");
    expect(band.querySelectorAll('circle[data-level="B1"]')).toHaveLength(2);
    expect(band.querySelectorAll('polyline[data-level="B1"]')).toHaveLength(1);

    const wpm = screen.getByLabelText("Speaking WPM over time");
    expect(wpm.querySelectorAll('circle[data-series="wpm"]')).toHaveLength(2);
    expect(wpm.querySelectorAll('polyline[data-series="wpm"]')).toHaveLength(1);
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

    expect(await screen.findByText("weakest over 30 days: Lexical")).toBeTruthy();
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
    expect(screen.getByText(/Last 5 B1 papers all ≥ 6\.5/)).toBeTruthy();

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
