import { describe, expect, it } from "vitest";
import { focusCategories } from "./focus-categories";
import type { MarkCategory, MarkSeverity, WritingMark } from "./types";

function mark(category: MarkCategory, severity: MarkSeverity = "error"): WritingMark {
  return { start: 0, end: 1, category, severity, correction: "x", note: "y" };
}

describe("focusCategories", () => {
  it("returns nothing for an empty list", () => {
    expect(focusCategories([])).toEqual([]);
  });

  it("returns the three most common categories, most common first", () => {
    const marks = [
      mark("spelling"), mark("spelling"), mark("spelling"),
      mark("article"), mark("article"),
      mark("preposition"),
      mark("pronoun"),
    ];
    // preposition and pronoun both appear once; preposition is earlier in the taxonomy.
    expect(focusCategories(marks)).toEqual(["spelling", "article", "preposition"]);
  });

  it("ignores the refinement tier", () => {
    const marks = [
      mark("word-choice", "refinement"), mark("word-choice", "refinement"),
      mark("word-choice", "refinement"), mark("register", "refinement"),
      mark("article"),
    ];
    expect(focusCategories(marks)).toEqual(["article"]);
  });

  it("breaks ties in taxonomy order", () => {
    expect(focusCategories([mark("spelling"), mark("article")])).toEqual([
      "article",
      "spelling",
    ]);
  });

  it("returns fewer than three when there are fewer categories", () => {
    expect(focusCategories([mark("article"), mark("article")])).toEqual(["article"]);
  });

  it("honours an explicit limit", () => {
    const marks = [mark("article"), mark("spelling"), mark("pronoun")];
    expect(focusCategories(marks, 2)).toEqual(["article", "spelling"]);
  });
});
