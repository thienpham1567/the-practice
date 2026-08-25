import { describe, expect, it } from "vitest";
import { computeStreak } from "./compute-streak.js";

function daysAgo(n: number, now: Date): Date {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - n);
  return date;
}

describe("computeStreak", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("counts today and yesterday as a current streak of 2", () => {
    expect(computeStreak([now, daysAgo(1, now)], now)).toEqual({ current: 2, longest: 2 });
  });

  it("resets current to 0 when yesterday was missed", () => {
    expect(computeStreak([daysAgo(2, now)], now)).toEqual({ current: 0, longest: 1 });
  });

  it("counts several submissions on the same day as one", () => {
    const todayMorning = new Date("2026-08-25T08:00:00Z");
    const todayEvening = new Date("2026-08-25T20:00:00Z");
    expect(computeStreak([todayMorning, todayEvening], now)).toEqual({ current: 1, longest: 1 });
  });

  it("returns 0/0 for an empty list", () => {
    expect(computeStreak([], now)).toEqual({ current: 0, longest: 0 });
  });

  it("tracks the longest historical streak separately from the current one", () => {
    const dates = [daysAgo(10, now), daysAgo(9, now), daysAgo(8, now), now];
    expect(computeStreak(dates, now)).toEqual({ current: 1, longest: 3 });
  });
});
