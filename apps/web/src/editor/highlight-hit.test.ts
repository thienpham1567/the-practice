import { describe, expect, it } from "vitest";
import type { Highlight } from "@writing-helper/analysis";
import { findSpanAtOffset } from "./highlight-hit";

const sentence: Highlight = { start: 0, end: 20, type: "hard-sentence" };
const adverb: Highlight = { start: 4, end: 11, type: "adverb" };
const complex: Highlight = { start: 20, end: 27, type: "complex-phrase" };

describe("findSpanAtOffset", () => {
  it("finds the span under the offset", () => {
    expect(findSpanAtOffset([complex], 22)).toBe(complex);
  });

  it("prefers the narrower span when they nest", () => {
    expect(findSpanAtOffset([sentence, adverb], 6)).toBe(adverb);
  });

  it("falls back to the wider span outside the narrow one", () => {
    expect(findSpanAtOffset([sentence, adverb], 15)).toBe(sentence);
  });

  it("treats end as exclusive", () => {
    expect(findSpanAtOffset([adverb], 11)).toBeNull();
  });

  it("treats start as inclusive", () => {
    expect(findSpanAtOffset([adverb], 4)).toBe(adverb);
  });

  it("returns null with no spans", () => {
    expect(findSpanAtOffset([], 5)).toBeNull();
  });

  it("works on any span shape, not just analysis highlights", () => {
    const mistake = { start: 2, end: 11, category: "word-order" as const };
    expect(findSpanAtOffset([mistake], 5)).toBe(mistake);
  });
});
