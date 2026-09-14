import type { WritingMark } from "@writing-helper/practice";
import { computeMarksResolution } from "./audit-marks-resolution";

function mark(overrides: Partial<WritingMark> & { start: number; end: number }): WritingMark {
  return {
    category: "verb-tense",
    severity: "error",
    correction: "fixed",
    note: "note",
    ...overrides,
  };
}

describe("computeMarksResolution", () => {
  it("marks a mistake resolved when its exact quote is gone from the new text", () => {
    const parentText = "Could you tell me when exactly you moving?";
    const parentMarks = [mark({ start: 31, end: 42 })]; // "you moving?"
    const newText = "Could you tell me when exactly you are moving?";

    expect(computeMarksResolution(parentText, parentMarks, newText)).toEqual([
      { quote: "you moving?", category: "verb-tense", resolved: true },
    ]);
  });

  it(
    "marks a mistake unresolved when its exact quote is still literally present — " +
      "this is the case that used to hallucinate: the AI narrator once claimed this " +
      "exact mistake was gone a full round after it actually was, because it was " +
      "reasoning from memory of a paraphrased summary instead of the real text",
    () => {
      const parentText = "Could you tell me when exactly you moving?";
      const parentMarks = [mark({ start: 31, end: 42 })]; // "you moving?"
      const newText = "Could you tell me when exactly you moving?"; // unchanged

      expect(computeMarksResolution(parentText, parentMarks, newText)).toEqual([
        { quote: "you moving?", category: "verb-tense", resolved: false },
      ]);
    },
  );

  it("treats a rewritten sentence (old quote gone) as resolved even if reworded imperfectly", () => {
    const parentText = "I will recieve your reply soon.";
    const parentMarks = [mark({ start: 7, end: 14 })]; // "recieve"
    const newText = "I look forward to your reply soon.";

    expect(computeMarksResolution(parentText, parentMarks, newText)[0]!.resolved).toBe(true);
  });

  it("checks each parent mark independently", () => {
    const parentText = "Me and my brother is free. I will recieve it.";
    const parentMarks = [
      mark({ start: 0, end: 3, category: "pronoun" }), // "Me "
      mark({ start: 34, end: 41, category: "spelling" }), // "recieve"
    ];
    const newText = "My brother and I are free. I will recieve it.";

    expect(computeMarksResolution(parentText, parentMarks, newText)).toEqual([
      { quote: "Me ", category: "pronoun", resolved: true },
      { quote: "recieve", category: "spelling", resolved: false },
    ]);
  });

  it(
    "marks an insertion fix resolved even though the old quote is still a literal " +
      "substring of the new text — observed live: \"new apartment\" → \"a new apartment\" " +
      "would otherwise read as unresolved forever, since the flawed span never fully disappears",
    () => {
      const parentText = "moving to new apartment next month";
      const parentMarks = [
        mark({ start: 10, end: 23, category: "article", correction: "a new apartment" }),
      ]; // "new apartment"
      const newText = "moving to a new apartment next month";

      expect(computeMarksResolution(parentText, parentMarks, newText)).toEqual([
        { quote: "new apartment", category: "article", resolved: true },
      ]);
    },
  );

  it("returns an empty list when there are no parent marks", () => {
    expect(computeMarksResolution("anything", [], "anything else")).toEqual([]);
  });
});
