import { describe, expect, it } from "vitest";
import type { Level } from "@writing-helper/practice";
import { BAND_THRESHOLD, CRITERION_FLOOR, WINDOW_SIZE, levelUpVerdict } from "./level-up";

type Scores = { task: number; coherence: number; lexical: number; grammar: number };

function point(overrides: {
  at: string;
  level: Level;
  band?: number;
  scores?: Partial<Scores>;
}) {
  return {
    at: overrides.at,
    level: overrides.level,
    band: overrides.band ?? 7,
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
  it("exposes the design thresholds", () => {
    expect(WINDOW_SIZE).toBe(5);
    expect(BAND_THRESHOLD).toBe(6.5);
    expect(CRITERION_FLOOR).toBe(6.0);
  });
});

describe("levelUpVerdict", () => {
  it("returns null when fewer than 5 attempts at the modal level", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1" }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1" }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1" }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1" }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("suggests the next level when the last 5 at the modal level clear both thresholds", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6.5 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.5 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 6.5 }),
    ];

    expect(levelUpVerdict(series, now)).toEqual({
      suggest: "B2",
      reason: "Last 5 B1 papers all ≥ 6.5",
    });
  });

  it("returns null when a band sits below the threshold", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 6.5 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 6.0 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 6.5 }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("returns null when any criterion sits below the floor", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({
        at: "2026-08-22T10:00:00.000Z",
        level: "B1",
        band: 7,
        scores: { grammar: 5.5 },
      }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 7 }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("treats criterion exactly at the floor as passing", () => {
    const series = [
      point({
        at: "2026-08-20T10:00:00.000Z",
        level: "A2",
        band: 6.5,
        scores: { task: 6.0, coherence: 6.0, lexical: 6.0, grammar: 6.0 },
      }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "A2", band: 6.5 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "A2", band: 6.5 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "A2", band: 6.5 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "A2", band: 6.5 }),
    ];

    expect(levelUpVerdict(series, now)).toEqual({
      suggest: "B1",
      reason: "Last 5 A2 papers all ≥ 6.5",
    });
  });

  it("returns null when the modal level is already C1", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "C1", band: 7 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "C1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "C1", band: 7 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "C1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "C1", band: 7 }),
    ];
    expect(levelUpVerdict(series, now)).toBeNull();
  });

  it("uses the level practiced most in the last 30 days, not older volume", () => {
    const series = [
      // Older A2 volume outside / at the edge of influence
      point({ at: "2026-07-01T10:00:00.000Z", level: "A2", band: 7 }),
      point({ at: "2026-07-02T10:00:00.000Z", level: "A2", band: 7 }),
      point({ at: "2026-07-03T10:00:00.000Z", level: "A2", band: 7 }),
      point({ at: "2026-07-04T10:00:00.000Z", level: "A2", band: 7 }),
      point({ at: "2026-07-05T10:00:00.000Z", level: "A2", band: 7 }),
      point({ at: "2026-07-06T10:00:00.000Z", level: "A2", band: 7 }),
      // Recent B1 modal window
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 7 }),
    ];

    expect(levelUpVerdict(series, now)).toEqual({
      suggest: "B2",
      reason: "Last 5 B1 papers all ≥ 6.5",
    });
  });

  it("ignores attempts older than 30 days when choosing the modal level", () => {
    const series = [
      point({ at: "2026-07-20T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-07-21T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-07-22T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-08-20T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B1", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B1", band: 7 }),
    ];

    expect(levelUpVerdict(series, now)?.suggest).toBe("B2");
  });

  it("maps B2 to C1", () => {
    const series = [
      point({ at: "2026-08-20T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-08-21T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-08-22T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-08-23T10:00:00.000Z", level: "B2", band: 7 }),
      point({ at: "2026-08-24T10:00:00.000Z", level: "B2", band: 7 }),
    ];

    expect(levelUpVerdict(series, now)).toEqual({
      suggest: "C1",
      reason: "Last 5 B2 papers all ≥ 6.5",
    });
  });

  it("returns null for an empty series", () => {
    expect(levelUpVerdict([], now)).toBeNull();
  });
});
