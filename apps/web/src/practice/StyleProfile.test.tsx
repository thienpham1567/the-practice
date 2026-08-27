import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalysisResult } from "@writing-helper/analysis";
import { StyleProfile } from "./StyleProfile";

afterEach(() => {
  cleanup();
});

function snapshot(partial: {
  passives?: number;
  adverbs?: number;
  words?: number;
  sentences?: number;
  omitStats?: boolean;
  omitSentences?: boolean;
}): AnalysisResult {
  const counts = {
    veryHardSentences: 0,
    hardSentences: 0,
    adverbs: partial.adverbs ?? 0,
    passives: partial.passives ?? 0,
    qualifiers: 0,
    complexPhrases: 0,
  };
  const stats = partial.omitStats
    ? (undefined as unknown as AnalysisResult["stats"])
    : {
        words: partial.words ?? 100,
        sentences: partial.omitSentences
          ? (undefined as unknown as number)
          : (partial.sentences ?? 5),
        paragraphs: 1,
        characters: 500,
        letters: 400,
        readingTimeSeconds: 30,
      };

  return {
    highlights: [],
    counts,
    goals: { adverbs: 3, passives: 2 },
    stats,
    grade: 8,
    gradeLabel: "OK",
  };
}

describe("StyleProfile", () => {
  it("hides the sentence-length line when stats are incomplete (no NaN)", () => {
    const { container } = render(
      <StyleProfile
        snapshot={snapshot({ words: 200, omitSentences: true, passives: 1, adverbs: 2 })}
        level="B1"
      />,
    );

    expect(container.textContent).not.toContain("NaN");
    expect(screen.queryByText(/words a sentence/i)).toBeNull();
    expect(screen.getByText(/1 passive construction/)).toBeTruthy();
    expect(screen.getByText(/2 spare adverbs/)).toBeTruthy();
  });

  it("hides the sentence-length line when sentences is 0", () => {
    render(
      <StyleProfile snapshot={snapshot({ words: 0, sentences: 0 })} level="A2" />,
    );

    expect(screen.queryByText(/words a sentence/i)).toBeNull();
  });

  it("shows the sentence-length line when stats are complete", () => {
    const { container } = render(
      <StyleProfile
        snapshot={snapshot({ words: 150, sentences: 10, passives: 0, adverbs: 0 })}
        level="B1"
      />,
    );

    expect(container.textContent).toMatch(
      /Average 15 words a sentence — a fit for B1/,
    );
  });
});
