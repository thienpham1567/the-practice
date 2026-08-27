import { describe, expect, it } from "vitest";
import { readStyleSnapshot } from "./style-snapshot";

describe("readStyleSnapshot", () => {
  it("returns passives, adverbs, and rounded average when stats are complete", () => {
    expect(
      readStyleSnapshot({
        counts: { passives: 2, adverbs: 3 },
        stats: { words: 200, sentences: 10 },
      }),
    ).toEqual({ passives: 2, adverbs: 3, average: 20 });
  });

  it("rounds average to one decimal place", () => {
    expect(
      readStyleSnapshot({
        counts: { passives: 0, adverbs: 0 },
        stats: { words: 100, sentences: 3 },
      }).average,
    ).toBe(33.3);
  });

  it("defaults missing counts to zero", () => {
    expect(
      readStyleSnapshot({
        stats: { words: 100, sentences: 5 },
      }),
    ).toEqual({ passives: 0, adverbs: 0, average: 20 });
  });

  it("returns average null when raw is null", () => {
    expect(readStyleSnapshot(null)).toEqual({
      passives: 0,
      adverbs: 0,
      average: null,
    });
  });

  it("returns average null when raw is missing or not an object", () => {
    expect(readStyleSnapshot(undefined).average).toBeNull();
    expect(readStyleSnapshot("oops").average).toBeNull();
  });

  it("returns average null when stats object is missing", () => {
    expect(
      readStyleSnapshot({
        counts: { passives: 1, adverbs: 2 },
      }).average,
    ).toBeNull();
  });

  it("returns average null when stats.sentences is missing (real DB shape)", () => {
    expect(
      readStyleSnapshot({
        stats: { words: 200 },
        counts: { passives: 1, adverbs: 4 },
      }),
    ).toEqual({ passives: 1, adverbs: 4, average: null });
  });

  it("returns average null when stats.words is missing", () => {
    expect(
      readStyleSnapshot({
        counts: { passives: 0, adverbs: 0 },
        stats: { sentences: 5 },
      }).average,
    ).toBeNull();
  });

  it("returns average null when sentences is 0", () => {
    expect(
      readStyleSnapshot({
        counts: { passives: 0, adverbs: 0 },
        stats: { words: 0, sentences: 0 },
      }).average,
    ).toBeNull();
  });
});
