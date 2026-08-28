import { describe, expect, it } from "vitest";
import { speakingFluency } from "./speaking-fluency";

describe("speakingFluency", () => {
  it("computes words per minute from transcript and duration", () => {
    // 120 words in 60_000 ms → 120 WPM
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    expect(speakingFluency(words, 60_000)).toEqual({
      wordsPerMinute: 120,
      fillerCount: 0,
    });
  });

  it("counts fillers at word boundaries only", () => {
    const transcript = "Um, I like, uh, learning. You know, summer is warm. Number.";
    // fillers: um, like, uh, you know → 4
    // "Number" must not count "um"; "summer" must not count "um"
    expect(speakingFluency(transcript, 60_000).fillerCount).toBe(4);
  });

  it("returns WPM 0 when durationMs is 0, not NaN", () => {
    const result = speakingFluency("hello world", 0);
    expect(result.wordsPerMinute).toBe(0);
    expect(Number.isNaN(result.wordsPerMinute)).toBe(false);
  });

  it("handles an empty transcript", () => {
    expect(speakingFluency("", 30_000)).toEqual({
      wordsPerMinute: 0,
      fillerCount: 0,
    });
    expect(speakingFluency("   ", 30_000)).toEqual({
      wordsPerMinute: 0,
      fillerCount: 0,
    });
  });

  it("is case-insensitive for fillers", () => {
    expect(speakingFluency("UH Er LIKE You Know um", 60_000).fillerCount).toBe(5);
  });
});
