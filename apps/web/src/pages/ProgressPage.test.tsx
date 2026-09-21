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
    expect(screen.getByRole("link", { name: "Start writing" }).getAttribute("href")).toBe("/writing");
    expect(screen.getByRole("link", { name: "Start speaking" }).getAttribute("href")).toBe(
      "/speaking",
    );
    expect(screen.queryByLabelText("Practice score over time")).toBeNull();
    expect(screen.queryByLabelText("Speaking progress")).toBeNull();
  });

  it("sits the ledger on the desk plate", async () => {
    vi.mocked(getProgress).mockResolvedValue(summary([]));
    renderPage();

    expect(await screen.findByRole("heading", { name: "Progress" })).toBeTruthy();
    expect(document.querySelector(".progress-desk")).toBeTruthy();
    expect(document.querySelector(".progress-sheet")).toBeTruthy();
    expect(document.querySelector("[data-atmosphere='progress']")).toBeTruthy();
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

    const writingChart = await screen.findByLabelText("Practice score over time");
    expect(writingChart.querySelectorAll('circle[data-series="score"]')).toHaveLength(3);
    expect(writingChart.querySelectorAll('polyline[data-series="score"]')).toHaveLength(1);
    expect(writingChart.querySelectorAll("[data-level]")).toHaveLength(0);

    const speakingSection = screen.getByLabelText("Speaking progress");
    expect(within(speakingSection).getByLabelText("Speaking score over time")).toBeTruthy();
    expect(
      within(speakingSection).getByLabelText("Speaking score over time").querySelectorAll(
        'circle[data-series="score"]',
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
    expect(screen.queryByLabelText("Practice score over time")).toBeNull();
    expect(screen.queryByLabelText("Writing progress")).toBeNull();

    const band = screen.getByLabelText("Speaking score over time");
    expect(band.querySelectorAll('circle[data-series="score"]')).toHaveLength(2);
    expect(band.querySelectorAll('polyline[data-series="score"]')).toHaveLength(1);
    expect(band.querySelectorAll("[data-level]")).toHaveLength(0);

    const wpm = screen.getByLabelText("Speaking WPM over time");
    expect(wpm.querySelectorAll('circle[data-series="wpm"]')).toHaveLength(2);
    expect(wpm.querySelectorAll('polyline[data-series="wpm"]')).toHaveLength(1);
  });

  it("plots one writing series even when level is TOEIC", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({
          at: "2026-08-20T10:00:00.000Z",
          level: "TOEIC" as ProgressSeriesPoint["level"],
          band: 140,
          estimatedScaled: 140,
        }),
        point({
          at: "2026-08-21T10:00:00.000Z",
          level: "TOEIC" as ProgressSeriesPoint["level"],
          band: 160,
          estimatedScaled: 160,
        }),
        point({
          at: "2026-08-22T10:00:00.000Z",
          level: "TOEIC" as ProgressSeriesPoint["level"],
          band: 180,
          estimatedScaled: 180,
        }),
      ]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Practice score over time");
    expect(chart.querySelectorAll('circle[data-series="score"]')).toHaveLength(3);
    expect(chart.querySelectorAll('polyline[data-series="score"]')).toHaveLength(1);
    expect(screen.queryByLabelText("Level legend")).toBeNull();
    expect(screen.queryByText("A2")).toBeNull();
    expect(screen.queryByText("B1")).toBeNull();
  });

  it("renders a single scored point as a dot without a polyline", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6 })]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Practice score over time");
    expect(chart.querySelectorAll('circle[data-series="score"]')).toHaveLength(1);
    expect(chart.querySelectorAll("polyline")).toHaveLength(0);
  });

  it("hides IELTS criteria sparklines for TOEIC practice scores", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({
          at: "2026-08-20T10:00:00.000Z",
          level: "TOEIC" as ProgressSeriesPoint["level"],
          band: 160,
          estimatedScaled: 160,
          scores: { task: 0, coherence: 0, lexical: 0, grammar: 0 },
        }),
        point({
          at: "2026-08-25T10:00:00.000Z",
          level: "TOEIC" as ProgressSeriesPoint["level"],
          band: 170,
          estimatedScaled: 170,
          scores: { task: 0, coherence: 0, lexical: 0, grammar: 0 },
        }),
      ]),
    );
    renderPage();

    expect(await screen.findByLabelText("Practice score over time")).toBeTruthy();
    expect(screen.queryByLabelText("Criteria trends")).toBeNull();
    expect(screen.queryByText(/weakest over 30 days/)).toBeNull();
    expect(screen.queryByLabelText("Task sparkline")).toBeNull();
    expect(screen.queryByLabelText("Coherence sparkline")).toBeNull();
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

  it("does not promote from IELTS band 6.5", async () => {
    const ieltsReady: ProgressSeriesPoint[] = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 6.5, scores: { task: 7, coherence: 7, lexical: 7, grammar: 7 } }),
    ];
    vi.mocked(getProgress).mockResolvedValue(summary(ieltsReady));
    renderPage();

    expect(await screen.findByLabelText("Practice score over time")).toBeTruthy();
    expect(screen.queryByLabelText("Level-up suggestion")).toBeNull();
    expect(screen.queryByText(/Last 5 B1 papers all ≥ 6\.5/)).toBeNull();
  });

  it("plots a 160 practice score inside the 0–200 chart", async () => {
    vi.mocked(getProgress).mockResolvedValue(
      summary([
        point({
          at: "2026-08-20T10:00:00.000Z",
          level: "B1",
          band: 160,
          estimatedScaled: 160,
          cefrEstimate: "B2",
        }),
      ]),
    );
    renderPage();

    const chart = await screen.findByLabelText("Practice score over time");
    const circle = chart.querySelector("circle");
    const y = Number(circle?.getAttribute("cy"));
    expect(y).toBeGreaterThan(10);
    expect(y).toBeLessThan(50);
    expect(screen.queryByText(/Part 2/)).toBeNull();
    expect(screen.queryByText(/Band 5\.5/)).toBeNull();
  });

  it("shows a CEFR level-up stamp from TOEIC scaled scores", async () => {
    const ready: ProgressSeriesPoint[] = [0, 1, 2, 3, 4].map((day) =>
      point({
        at: `2026-08-2${day}T10:00:00.000Z`,
        level: "B1",
        band: 160,
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
    );
    vi.mocked(getProgress).mockResolvedValue(summary(ready));
    renderPage();

    expect(await screen.findByLabelText("Level-up suggestion")).toBeTruthy();
    expect(screen.getByText("C1")).toBeTruthy();
    expect(screen.getByText(/writing C1 starts at 180/)).toBeTruthy();
  });
});
