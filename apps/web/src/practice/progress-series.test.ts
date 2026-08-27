import { describe, expect, it } from "vitest";
import type { Level } from "@writing-helper/practice";
import {
  bandSeriesByLevel,
  criteriaAverage30d,
  per100Series,
} from "./progress-series";

type Scores = { task: number; coherence: number; lexical: number; grammar: number };

function point(overrides: {
  at: string;
  level: Level;
  band?: number;
  scores?: Partial<Scores>;
  per100?: { passives: number; adverbs: number } | null;
}) {
  return {
    at: overrides.at,
    level: overrides.level,
    band: overrides.band ?? 6,
    scores: {
      task: 6,
      coherence: 6,
      lexical: 6,
      grammar: 6,
      ...overrides.scores,
    },
    per100: overrides.per100 === undefined ? null : overrides.per100,
  };
}

const now = new Date("2026-08-27T12:00:00.000Z");

describe("bandSeriesByLevel", () => {
  it("groups points into BandPoint arrays per level, chronological", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 5.5 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B2", band: 6 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5 }),
    ];

    const grouped = bandSeriesByLevel(series);

    expect(grouped.get("B1")).toEqual([
      { at: Date.parse("2026-08-20T10:00:00.000Z"), band: 5.5 },
      { at: Date.parse("2026-08-22T10:00:00.000Z"), band: 6.5 },
    ]);
    expect(grouped.get("B2")).toEqual([
      { at: Date.parse("2026-08-21T10:00:00.000Z"), band: 6 },
    ]);
    expect(grouped.has("A2")).toBe(false);
  });

  it("returns an empty map for an empty series", () => {
    expect(bandSeriesByLevel([])).toEqual(new Map());
  });
});

describe("criteriaAverage30d", () => {
  it("averages criteria over the last 30 days and names the weakest", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "B1",
        scores: { task: 7, coherence: 6, lexical: 5, grammar: 6 },
      }),
      point({
        at: "2026-08-25T10:00:00.000Z",
        level: "B1",
        scores: { task: 7, coherence: 6, lexical: 5, grammar: 8 },
      }),
      // Outside the 30-day window
      point({
        at: "2026-07-01T10:00:00.000Z",
        level: "B1",
        scores: { task: 1, coherence: 1, lexical: 9, grammar: 1 },
      }),
    ];

    expect(criteriaAverage30d(series, now)).toEqual({
      averages: { task: 7, coherence: 6, lexical: 5, grammar: 7 },
      weakest: "lexical",
    });
  });

  it("returns null when nothing falls in the last 30 days", () => {
    expect(
      criteriaAverage30d(
        [point({ at: "2026-07-01T10:00:00.000Z", level: "B1" })],
        now,
      ),
    ).toBeNull();
  });

  it("breaks weakest ties by criterion order task → coherence → lexical → grammar", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "B1",
        scores: { task: 5, coherence: 5, lexical: 6, grammar: 6 },
      }),
    ];
    expect(criteriaAverage30d(series, now)?.weakest).toBe("task");
  });
});

describe("per100Series", () => {
  it("keeps only points with per100 so nulls do not break the time axis", () => {
    const series = [
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
    ];

    expect(per100Series(series)).toEqual([
      {
        at: Date.parse("2026-08-20T10:00:00.000Z"),
        passives: 0.8,
        adverbs: 1.2,
      },
      {
        at: Date.parse("2026-08-22T10:00:00.000Z"),
        passives: 1.0,
        adverbs: 0.5,
      },
    ]);
  });

  it("returns an empty list when every point lacks per100", () => {
    expect(
      per100Series([point({ at: "2026-08-20T10:00:00.000Z", level: "B1" })]),
    ).toEqual([]);
  });
});
