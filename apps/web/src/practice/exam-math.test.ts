import { describe, expect, it } from "vitest";
import {
  countWords,
  formatClock,
  lastFourteenDays,
  remainingSeconds,
  wordCountTone,
} from "./exam-math";

describe("lastFourteenDays", () => {
  const now = new Date("2026-08-25T12:00:00Z");

  it("marks only days that have a submission", () => {
    const today = new Date("2026-08-25T08:00:00Z");
    const twoDaysAgo = new Date("2026-08-23T18:00:00Z");
    const flags = lastFourteenDays([today, twoDaysAgo], now);

    expect(flags).toHaveLength(14);
    expect(flags[13]).toBe(true);
    expect(flags[12]).toBe(false);
    expect(flags[11]).toBe(true);
  });
});

describe("remainingSeconds", () => {
  it("counts down from the server startedAt, so a reload does not reset it", () => {
    const startedAt = new Date("2026-08-25T10:00:00Z");
    const now = new Date("2026-08-25T10:05:00Z");
    expect(remainingSeconds(startedAt, 20, now)).toBe(15 * 60);
  });

  it("stops at zero instead of going negative", () => {
    const startedAt = new Date("2026-08-25T10:00:00Z");
    const now = new Date("2026-08-25T10:30:00Z");
    expect(remainingSeconds(startedAt, 20, now)).toBe(0);
  });
});

describe("formatClock", () => {
  it("pads seconds", () => {
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("word count", () => {
  it("treats empty text as zero words", () => {
    expect(countWords("   ")).toBe(0);
  });

  it("flags a count under the minimum", () => {
    expect(wordCountTone(79, 80)).toBe("under");
    expect(wordCountTone(80, 80)).toBe("met");
  });
});
