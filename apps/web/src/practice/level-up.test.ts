import { describe, expect, it } from "vitest";
import type { Level } from "@writing-helper/practice";
import { WINDOW_SIZE, levelUpVerdict } from "./level-up";

type Scores = { task: number; coherence: number; lexical: number; grammar: number };

function point(overrides: {
  at: string;
  level: Level;
  band?: number;
  estimatedScaled?: number | null;
  cefrEstimate?: string | null;
  scores?: Partial<Scores>;
}) {
  return {
    at: overrides.at,
    level: overrides.level,
    band: overrides.band ?? 7,
    estimatedScaled: overrides.estimatedScaled,
    cefrEstimate: overrides.cefrEstimate,
    scores: {
      task: 7,
      coherence: 7,
      lexical: 7,
      grammar: 7,
      ...overrides.scores,
    },
    per100: null as { passives: number; adverbs: number } | null,
  };
}

const now = new Date("2026-08-27T12:00:00.000Z");

describe("level-up constants", () => {
  it("keeps a five-paper window and does not export an IELTS 6.5 threshold", async () => {
    expect(WINDOW_SIZE).toBe(5);
    const mod = await import("./level-up");
    expect("BAND_THRESHOLD" in mod).toBe(false);
  });
});

describe("levelUpVerdict", () => {
  it("returns null for an empty series", () => {
    expect(levelUpVerdict([], now)).toBeNull();
  });

  it("does not promote from IELTS band 6.5", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6.5 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 6.5 }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("returns null when fewer than 5 TOEIC papers sit at the modal CEFR", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-21T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-22T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 150,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-23T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("suggests C1 when the last 5 writing papers are all at B2", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-21T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 150,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-22T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 170,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-23T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 160,
        cefrEstimate: "B2",
      }),
      point({
        at: "2026-08-24T10:00:00.000Z",
        level: "B1",
        estimatedScaled: 150,
        cefrEstimate: "B2",
      }),
    ];

    expect(levelUpVerdict(series, now)).toEqual({
      suggest: "C1",
      reason: "Last 5 papers at B2 — writing C1 starts at 180",
    });
  });

  it("returns null when the modal CEFR is already C1", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "C1",
        estimatedScaled: 180,
        cefrEstimate: "C1",
      }),
      point({
        at: "2026-08-21T10:00:00.000Z",
        level: "C1",
        estimatedScaled: 200,
        cefrEstimate: "C1",
      }),
      point({
        at: "2026-08-22T10:00:00.000Z",
        level: "C1",
        estimatedScaled: 180,
        cefrEstimate: "C1",
      }),
      point({
        at: "2026-08-23T10:00:00.000Z",
        level: "C1",
        estimatedScaled: 190,
        cefrEstimate: "C1",
      }),
      point({
        at: "2026-08-24T10:00:00.000Z",
        level: "C1",
        estimatedScaled: 180,
        cefrEstimate: "C1",
      }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });
});
