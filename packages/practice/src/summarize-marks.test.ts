import { describe, expect, it } from "vitest";
import { summarizeMarks } from "./summarize-marks";
import type { AttemptMarkInput, MarkCategory, WritingMark } from "./types";

function mark(category: MarkCategory): WritingMark {
  return { start: 0, end: 1, category, severity: "error", correction: "x", note: "y" };
}

function attempt(day: number, categories: MarkCategory[], wordCount = 100): AttemptMarkInput {
  return {
    marks: categories.map(mark),
    wordCount,
    submittedAt: new Date(Date.UTC(2026, 0, day)),
  };
}

describe("summarizeMarks", () => {
  it("returns an empty profile for no attempts", () => {
    expect(summarizeMarks([])).toEqual({ tallies: [], attemptsConsidered: 0 });
  });

  it("drops categories seen only once", () => {
    const profile = summarizeMarks([attempt(1, ["article", "spelling"])]);
    expect(profile.tallies).toEqual([]);
    expect(profile.attemptsConsidered).toBe(1);
  });

  it("keeps categories seen at least twice, sorted by count", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "spelling", "spelling", "spelling"]),
    ]);
    expect(profile.tallies.map((t) => [t.category, t.count])).toEqual([
      ["spelling", 3],
      ["article", 2],
    ]);
  });

  it("breaks count ties in taxonomy order", () => {
    // article is declared before spelling, so it must come first.
    const profile = summarizeMarks([
      attempt(1, ["spelling", "spelling", "article", "article"]),
    ]);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("keeps only the 10 most recent attempts", () => {
    const many = Array.from({ length: 12 }, (_, i) => attempt(i + 1, ["article", "article"]));
    const profile = summarizeMarks(many);
    expect(profile.attemptsConsidered).toBe(10);
    // Days 1 and 2 fall outside the window: 10 x 2 = 20, not 24.
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 20 });
  });

  it("sorts by submittedAt itself, so caller order does not matter", () => {
    const shuffled = [
      attempt(3, ["article", "article"]),
      attempt(1, ["spelling"]),
      attempt(2, ["spelling"]),
    ];
    const profile = summarizeMarks(shuffled);
    expect(profile.attemptsConsidered).toBe(3);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("leaves trend null below four attempts", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article"]),
      attempt(2, ["article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBeNull();
  });

  it("reports down when the recent half improves", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "article", "article"]),
      attempt(2, ["article", "article", "article", "article"]),
      attempt(3, []),
      attempt(4, []),
    ]);
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 8, trend: "down" });
  });

  it("reports up when the recent half worsens", () => {
    const profile = summarizeMarks([
      attempt(1, []),
      attempt(2, []),
      attempt(3, ["article", "article", "article", "article"]),
      attempt(4, ["article", "article", "article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("up");
  });

  it("reports flat when the rate barely moves", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article"]),
      attempt(2, ["article", "article"]),
      attempt(3, ["article", "article"]),
      attempt(4, ["article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("normalises by words, so longer papers are not read as regression", () => {
    // Same rate per 100 words in both halves; the recent papers are just longer.
    const profile = summarizeMarks([
      attempt(1, ["article", "article"], 100),
      attempt(2, ["article", "article"], 100),
      attempt(3, ["article", "article", "article", "article"], 200),
      attempt(4, ["article", "article", "article", "article"], 200),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("puts the middle paper in the recent half when the count is odd", () => {
    // 5 papers: older = days 1-2, recent = days 3-5. The clean day 3 lands in
    // the recent half, which is what makes this read as down.
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "article"]),
      attempt(2, ["article", "article", "article"]),
      attempt(3, []),
      attempt(4, []),
      attempt(5, []),
    ]);
    expect(profile.tallies[0]!.trend).toBe("down");
  });
});
